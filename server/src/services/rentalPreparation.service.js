const prisma = require('../prisma');

// Misma regla que la lista de Solicitudes, para que un alquiler aparezca como
// aprobado en las dos pantallas: se deriva de los votos (Approval = si,
// Objection = no) ademas del status, por si el status guardado no se actualizo
// al votar.
function deriveStatus({ status, approvals, objections }, coownerCount) {
  if (status === 'REJECTED' || objections > 0) return 'REJECTED';
  if (status === 'ACTIVE') return 'APPROVED';
  if (coownerCount > 0 && approvals >= coownerCount) return 'APPROVED';
  return 'PENDING';
}

// Aprobado segun la regla de Solicitudes. deriveStatus no mira CANCELLED (la
// lista lo filtra en la consulta), asi que el alta lo descarta aca; lista y alta
// comparten esta funcion para que no diverjan.
function isApproved(reservation, coownerCount) {
  return (
    reservation.status !== 'CANCELLED' &&
    deriveStatus(
      {
        status: reservation.status,
        approvals: reservation.approvals.length,
        objections: reservation.objections.length,
      },
      coownerCount,
    ) === 'APPROVED'
  );
}

// En UTC, para que el client no corra el dia por su zona horaria.
function toDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

// La fecha de fin es un dia (YYYY-MM-DD). "Hoy" se toma en horario de Argentina
// porque el server corre en UTC (Render): de noche ya seria el dia siguiente.
const ARGENTINA_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Argentina/Buenos_Aires',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function todayInArgentina(now = new Date()) {
  return ARGENTINA_DAY.format(now);
}

// El dia de fin todavia cuenta: termino recien cuando hoy es posterior.
function hasFinished(endDate, now) {
  return toDateOnly(endDate) < todayInArgentina(now);
}

function toTask(task) {
  return {
    id: task.id,
    name: task.name,
    completed: task.completed,
    // Nunca el User completo: tiene phone y passwordHash.
    assignedTo: { id: task.assignedTo.id, name: task.assignedTo.name },
  };
}

function toListItem(reservation, { coowners, now }) {
  const tasks = reservation.tasks.map(toTask);
  const completed = tasks.filter((task) => task.completed).length;

  return {
    id: reservation.id,
    renterName: reservation.renter?.name ?? null,
    startDate: toDateOnly(reservation.startDate),
    endDate: toDateOnly(reservation.endDate),
    tasks,
    // Se calcula al leer; no se guarda nada.
    summary: { total: tasks.length, completed, pending: tasks.length - completed },
    // Para que el client oculte el formulario de alta; el POST lo vuelve a validar.
    finished: hasFinished(reservation.endDate, now),
    // Para el desplegable de responsable.
    coowners,
  };
}

const TASK_SELECT = {
  id: true,
  name: true,
  completed: true,
  assignedTo: { select: { id: true, name: true } },
};

const RESERVATION_SELECT = {
  id: true,
  status: true,
  startDate: true,
  endDate: true,
  renter: { select: { name: true } },
  approvals: { select: { userId: true } },
  objections: { select: { userId: true } },
  tasks: {
    // Orden de carga; el id desempata tareas creadas en el mismo instante.
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: TASK_SELECT,
  },
};

// Alquileres aprobados del bien, con sus tareas y responsables. Una sola
// consulta: el asset con sus copropietarios (User) y sus alquileres. "Aprobado"
// no existe como estado en el modelo: se deriva con deriveStatus.
//
// `db` se inyecta (default: el Prisma compartido) porque los delegates de
// Prisma no se pueden mockear directamente en los tests.
//
// Devuelve null si el bien no existe.
async function listByAsset(assetId, db = prisma, now = new Date()) {
  const asset = await db.asset.findUnique({
    where: { id: assetId },
    select: {
      // Copropietarios: cuentan para la aprobacion y llenan el desplegable de responsable.
      users: { select: { id: true, name: true }, orderBy: { name: 'asc' } },
      reservations: {
        // Los alquileres pasados tambien se listan: no se filtra por fecha.
        where: { type: 'RENTAL', status: { not: 'CANCELLED' } },
        orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
        select: RESERVATION_SELECT,
      },
    },
  });
  if (!asset) return null;

  const coownerCount = asset.users.length;
  // Explicito: nunca el User entero (phone, passwordHash).
  const coowners = asset.users.map((user) => ({ id: user.id, name: user.name }));

  return asset.reservations
    .filter((reservation) => isApproved(reservation, coownerCount))
    .map((reservation) => toListItem(reservation, { coowners, now }));
}

const NAME_MAX = 100;

const ERRORS = {
  reservationRequired: 'Falta el alquiler',
  nameRequired: 'Falta el nombre de la tarea',
  nameTooLong: `El nombre no puede superar los ${NAME_MAX} caracteres`,
  assigneeRequired: 'Falta elegir un responsable',
  assigneeNotCoowner: 'El responsable no es copropietario del bien',
  reservationNotFound: 'No existe el alquiler',
  notApproved: 'El alquiler todavía no está aprobado',
  finished: 'El alquiler ya terminó',
  taskNotFound: 'No existe la tarea',
  nothingToUpdate: 'No hay nada para modificar',
  completedInvalid: 'El estado de la tarea tiene que ser verdadero o falso',
};

const isFilled = (value) => typeof value === 'string' && value.trim() !== '';

// Valida la forma del body, sin tocar la base. Devuelve todos los errores juntos
// (no solo el primero) y el nombre ya recortado. El largo se cuenta en
// caracteres (Array.from), no en unidades UTF-16, para que un emoji valga uno.
function validateTaskInput(input) {
  const { reservationId, name, assignedToId } = input ?? {};
  const errors = [];

  if (!isFilled(reservationId)) errors.push(ERRORS.reservationRequired);

  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (trimmed === '') errors.push(ERRORS.nameRequired);
  else if (Array.from(trimmed).length > NAME_MAX) errors.push(ERRORS.nameTooLong);

  if (!isFilled(assignedToId)) errors.push(ERRORS.assigneeRequired);

  return { errors, name: trimmed };
}

const fail = (status, ...errors) => ({ ok: false, status, errors });

// Crea una tarea de preparacion. No confia en lo que valido la pantalla: repite
// todas las reglas. Devuelve { ok: true, task } o { ok: false, status, errors }.
//
// Orden: forma del body (400) -> el alquiler existe (404) -> esta aprobado (409)
// -> no termino (409) -> el responsable es copropietario del bien (400).
async function createTask(input, db = prisma, now = new Date()) {
  const { errors, name } = validateTaskInput(input);
  if (errors.length > 0) return fail(400, ...errors);
  const { reservationId, assignedToId } = input;

  const reservation = await db.reservation.findUnique({
    where: { id: reservationId },
    select: {
      type: true,
      status: true,
      endDate: true,
      approvals: { select: { userId: true } },
      objections: { select: { userId: true } },
      asset: { select: { users: { select: { id: true } } } },
    },
  });
  if (!reservation || reservation.type !== 'RENTAL') return fail(404, ERRORS.reservationNotFound);

  const coownerIds = reservation.asset.users.map((user) => user.id);
  if (!isApproved(reservation, coownerIds.length)) return fail(409, ERRORS.notApproved);
  if (hasFinished(reservation.endDate, now)) return fail(409, ERRORS.finished);
  if (!coownerIds.includes(assignedToId)) return fail(400, ERRORS.assigneeNotCoowner);

  const task = await db.rentalTask.create({
    data: { reservationId, assignedToId, name },
    select: TASK_SELECT,
  });
  return { ok: true, task: toTask(task) };
}

// Prisma tira P2025 cuando el registro a modificar o borrar ya no existe (otro
// lo borro entre el findUnique y el update/delete).
const isRecordNotFound = (err) => err?.code === 'P2025';

// Forma de un id de tarea (cuid). Un id con un byte NUL hace fallar la consulta
// en Postgres y daria un 500; asi se responde 404 sin llegar a la base.
const TASK_ID_FORMAT = /^[A-Za-z0-9_-]{1,64}$/;

// La tarea con lo justo de su alquiler para validar: cuando termina y quienes son
// los copropietarios del bien. Modificar y borrar comparten esta consulta y, con
// ella, la misma regla de fecha que el alta (hasFinished). Devuelve null si el id
// no puede ser de una tarea o no existe.
async function findTaskForChange(id, db) {
  if (typeof id !== 'string' || !TASK_ID_FORMAT.test(id)) return null;

  return db.rentalTask.findUnique({
    where: { id },
    select: {
      ...TASK_SELECT,
      reservation: {
        select: { endDate: true, asset: { select: { users: { select: { id: true } } } } },
      },
    },
  });
}

// Valida la forma del body de la modificacion, sin tocar la base. Los dos campos
// son opcionales, pero tiene que venir al menos uno. Un responsable vacio no se
// acepta: una tarea nunca queda sin responsable.
function validateUpdateInput(input) {
  const { completed, assignedToId } = input ?? {};
  const errors = [];

  if (completed === undefined && assignedToId === undefined) errors.push(ERRORS.nothingToUpdate);
  if (completed !== undefined && typeof completed !== 'boolean') errors.push(ERRORS.completedInvalid);
  if (assignedToId !== undefined && !isFilled(assignedToId)) errors.push(ERRORS.assigneeRequired);

  return errors;
}

// Tilda/destilda una tarea y/o le cambia el responsable. Cualquier copropietario
// puede (no se recibe quien llama). Devuelve { ok: true, task } o
// { ok: false, status, errors }.
//
// Orden: forma del body (400) -> la tarea existe (404) -> el alquiler no termino
// (409) -> el responsable es copropietario del bien (400). Pedir lo que la tarea
// ya tiene no escribe nada y no es un error, salvo que el alquiler haya terminado.
async function updateTask(id, input, db = prisma, now = new Date()) {
  const errors = validateUpdateInput(input);
  if (errors.length > 0) return fail(400, ...errors);
  const { completed, assignedToId } = input;

  const task = await findTaskForChange(id, db);
  if (!task) return fail(404, ERRORS.taskNotFound);
  if (hasFinished(task.reservation.endDate, now)) return fail(409, ERRORS.finished);
  if (
    assignedToId !== undefined &&
    !task.reservation.asset.users.some((user) => user.id === assignedToId)
  ) {
    return fail(400, ERRORS.assigneeNotCoowner);
  }

  const data = {};
  if (completed !== undefined && completed !== task.completed) {
    data.completed = completed;
    data.completedAt = completed ? now : null;
  }
  if (assignedToId !== undefined && assignedToId !== task.assignedTo.id) {
    data.assignedToId = assignedToId;
  }
  if (Object.keys(data).length === 0) return { ok: true, task: toTask(task) };

  try {
    const updated = await db.rentalTask.update({ where: { id }, data, select: TASK_SELECT });
    return { ok: true, task: toTask(updated) };
  } catch (err) {
    if (isRecordNotFound(err)) return fail(404, ERRORS.taskNotFound);
    throw err;
  }
}

// Borra una tarea de verdad (no queda marca de eliminada). Mismas reglas de
// existencia (404) y de fecha (409) que updateTask. Devuelve { ok: true } o
// { ok: false, status, errors }.
async function deleteTask(id, db = prisma, now = new Date()) {
  const task = await findTaskForChange(id, db);
  if (!task) return fail(404, ERRORS.taskNotFound);
  if (hasFinished(task.reservation.endDate, now)) return fail(409, ERRORS.finished);

  try {
    await db.rentalTask.delete({ where: { id } });
    return { ok: true };
  } catch (err) {
    if (isRecordNotFound(err)) return fail(404, ERRORS.taskNotFound);
    throw err;
  }
}

module.exports = {
  listByAsset,
  createTask,
  updateTask,
  deleteTask,
  validateTaskInput,
  todayInArgentina,
};
