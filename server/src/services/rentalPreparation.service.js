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

// En UTC, para que el client no corra el dia por su zona horaria.
function toDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function toListItem(reservation) {
  const tasks = reservation.tasks.map((task) => ({
    id: task.id,
    name: task.name,
    completed: task.completed,
    // Nunca el User completo: tiene phone y passwordHash.
    assignedTo: { id: task.assignedTo.id, name: task.assignedTo.name },
  }));
  const completed = tasks.filter((task) => task.completed).length;

  return {
    id: reservation.id,
    renterName: reservation.renter?.name ?? null,
    startDate: toDateOnly(reservation.startDate),
    endDate: toDateOnly(reservation.endDate),
    tasks,
    // Se calcula al leer; no se guarda nada.
    summary: { total: tasks.length, completed, pending: tasks.length - completed },
  };
}

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
    select: {
      id: true,
      name: true,
      completed: true,
      assignedTo: { select: { id: true, name: true } },
    },
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
async function listByAsset(assetId, db = prisma) {
  const asset = await db.asset.findUnique({
    where: { id: assetId },
    select: {
      users: { select: { id: true } },
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

  return asset.reservations
    .filter(
      (reservation) =>
        deriveStatus(
          {
            status: reservation.status,
            approvals: reservation.approvals.length,
            objections: reservation.objections.length,
          },
          coownerCount,
        ) === 'APPROVED',
    )
    .map(toListItem);
}

module.exports = { listByAsset };
