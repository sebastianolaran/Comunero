const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createTask,
  validateTaskInput,
  todayInArgentina,
} = require('../src/services/rentalPreparation.service');

// Igual que en la lista: los delegates de Prisma no se pueden mockear, asi que
// el service recibe la "db" por parametro y aca le pasamos una falsa.

const ANA = { id: 'u1', name: 'Ana' };
const BRUNO = { id: 'u2', name: 'Bruno' };
const CARLA = { id: 'u3', name: 'Carla' };
const FLOR = { id: 'u4', name: 'Flor' };
const COPROPIETARIOS = [ANA, BRUNO, CARLA, FLOR];
const TODOS = COPROPIETARIOS.map((u) => ({ userId: u.id }));

// 15/09/2026 12:00 en Argentina (UTC-3).
const HOY = new Date('2026-09-15T15:00:00.000Z');

// Por defecto: alquiler aprobado por los cuatro, que termina el 16/09.
function reserva(overrides = {}) {
  return {
    type: 'RENTAL',
    status: 'PENDING',
    endDate: new Date('2026-09-16T00:00:00.000Z'),
    approvals: TODOS,
    objections: [],
    asset: { users: COPROPIETARIOS.map(({ id }) => ({ id })) },
    ...overrides,
  };
}

function fakeDb(reservation) {
  const calls = { find: [], create: [] };
  const db = {
    reservation: {
      findUnique: async (args) => {
        calls.find.push(args);
        return reservation;
      },
    },
    rentalTask: {
      create: async (args) => {
        calls.create.push(args);
        return {
          id: 'nueva',
          name: args.data.name,
          completed: false,
          assignedTo: COPROPIETARIOS.find((u) => u.id === args.data.assignedToId),
        };
      },
    },
  };
  return { db, calls };
}

const valido = (overrides = {}) => ({
  reservationId: 'r1',
  name: 'Revisar pileta',
  assignedToId: 'u1',
  ...overrides,
});

async function crear(input, res = reserva(), now = HOY) {
  const { db, calls } = fakeDb(res);
  const resultado = await createTask(input, db, now);
  return { resultado, calls };
}

const NOMBRE_FALTA = 'Falta el nombre de la tarea';
const NOMBRE_LARGO = 'El nombre no puede superar los 100 caracteres';
const RESPONSABLE_FALTA = 'Falta elegir un responsable';

// ---------- la fecha de hoy en Argentina ----------

test('todayInArgentina: al mediodía argentino es el mismo día que en UTC', () => {
  assert.equal(todayInArgentina(new Date('2026-09-15T15:00:00.000Z')), '2026-09-15');
});

test('todayInArgentina: de noche en Argentina UTC ya está en el día siguiente, pero acá sigue siendo hoy', () => {
  // 23:30 del 15/09 en Argentina = 02:30 del 16/09 en UTC (donde corre Render).
  assert.equal(todayInArgentina(new Date('2026-09-16T02:30:00.000Z')), '2026-09-15');
});

test('todayInArgentina: pasa al día siguiente a las 00:00 argentinas (03:00 UTC)', () => {
  assert.equal(todayInArgentina(new Date('2026-09-16T03:00:00.000Z')), '2026-09-16');
});

// ---------- validateTaskInput ----------

test('validateTaskInput: un nombre y un responsable válidos no dan errores y el nombre queda recortado', () => {
  const r = validateTaskInput(valido({ name: '  Revisar pileta  ' }));

  assert.deepEqual(r.errors, []);
  assert.equal(r.name, 'Revisar pileta');
});

test('validateTaskInput: nombre vacío da el error de nombre', () => {
  assert.deepEqual(validateTaskInput(valido({ name: '' })).errors, [NOMBRE_FALTA]);
});

test('validateTaskInput: nombre de solo espacios da el error de nombre', () => {
  assert.deepEqual(validateTaskInput(valido({ name: '     ' })).errors, [NOMBRE_FALTA]);
});

test('validateTaskInput: un nombre que no es texto se trata como faltante', () => {
  for (const name of [undefined, null, 42, {}, ['x']]) {
    assert.deepEqual(validateTaskInput(valido({ name })).errors, [NOMBRE_FALTA]);
  }
});

test('validateTaskInput: 100 caracteres se aceptan y 101 no', () => {
  assert.deepEqual(validateTaskInput(valido({ name: 'a'.repeat(100) })).errors, []);
  assert.deepEqual(validateTaskInput(valido({ name: 'a'.repeat(101) })).errors, [NOMBRE_LARGO]);
});

test('validateTaskInput: el largo se mide sin los espacios de los extremos', () => {
  assert.deepEqual(validateTaskInput(valido({ name: `  ${'a'.repeat(100)}  ` })).errors, []);
});

test('validateTaskInput: el largo cuenta caracteres, no unidades UTF-16 (un emoji vale uno)', () => {
  // '😀' ocupa 2 unidades UTF-16: con .length, 100 emojis darian 200 y fallarian.
  assert.deepEqual(validateTaskInput(valido({ name: '😀'.repeat(100) })).errors, []);
  assert.deepEqual(validateTaskInput(valido({ name: '😀'.repeat(101) })).errors, [NOMBRE_LARGO]);
});

test('validateTaskInput: los espacios del medio se conservan', () => {
  assert.equal(validateTaskInput(valido({ name: ' Cambiar   sábanas ' })).name, 'Cambiar   sábanas');
});

test('validateTaskInput: sin responsable da el error de responsable', () => {
  for (const assignedToId of [undefined, null, '', '   ', 7]) {
    assert.deepEqual(validateTaskInput(valido({ assignedToId })).errors, [RESPONSABLE_FALTA]);
  }
});

test('validateTaskInput: sin nombre y sin responsable da los dos errores, nombre primero', () => {
  const r = validateTaskInput(valido({ name: '', assignedToId: '' }));

  assert.deepEqual(r.errors, [NOMBRE_FALTA, RESPONSABLE_FALTA]);
});

test('validateTaskInput: sin alquiler da el error de alquiler', () => {
  for (const reservationId of [undefined, null, '', '  ']) {
    assert.deepEqual(validateTaskInput(valido({ reservationId })).errors, ['Falta el alquiler']);
  }
});

test('validateTaskInput: un body ausente no rompe', () => {
  assert.equal(validateTaskInput(undefined).errors.length, 3);
});

// ---------- createTask: el caso feliz ----------

test('createTask: crea la tarea sin tildar y devuelve id, nombre, estado y responsable', async () => {
  const { resultado, calls } = await crear(valido());

  assert.deepEqual(resultado, {
    ok: true,
    task: { id: 'nueva', name: 'Revisar pileta', completed: false, assignedTo: { id: 'u1', name: 'Ana' } },
  });
  assert.equal(calls.create.length, 1);
  assert.deepEqual(calls.create[0].data, {
    reservationId: 'r1',
    assignedToId: 'u1',
    name: 'Revisar pileta',
  });
});

test('createTask: guarda el nombre sin los espacios del principio y del final', async () => {
  const { calls } = await crear(valido({ name: '   Revisar pileta   ' }));

  assert.equal(calls.create[0].data.name, 'Revisar pileta');
});

test('createTask: el responsable es el elegido, no quien carga (Carla y no Bruno)', async () => {
  const { resultado, calls } = await crear(valido({ name: 'Reponer gas y carbón', assignedToId: 'u3' }));

  assert.equal(calls.create[0].data.assignedToId, 'u3');
  assert.deepEqual(resultado.task.assignedTo, { id: 'u3', name: 'Carla' });
});

test('createTask: uno mismo puede ser el responsable', async () => {
  const { resultado } = await crear(valido({ assignedToId: 'u2' }));

  assert.equal(resultado.ok, true);
  assert.deepEqual(resultado.task.assignedTo, { id: 'u2', name: 'Bruno' });
});

test('createTask: crear no consulta las tareas existentes, así que no hay regla de unicidad de nombres', async () => {
  // Es lo que permite dos tareas con el mismo nombre en un mismo alquiler.
  const { resultado, calls } = await crear(valido({ name: 'Cambiar sábanas y toallas' }));

  assert.equal(resultado.ok, true);
  assert.equal(JSON.stringify(calls.find[0]).includes('tasks'), false);
});

test('createTask: crear dos veces el mismo nombre en el mismo alquiler da dos tareas', async () => {
  const { db, calls } = fakeDb(reserva());
  const input = valido({ name: 'Cambiar sábanas y toallas' });

  const primera = await createTask(input, db, HOY);
  const segunda = await createTask(input, db, HOY);

  assert.equal(primera.ok && segunda.ok, true);
  assert.equal(calls.create.length, 2);
});

test('createTask: nunca pide ni devuelve datos sensibles de los usuarios', async () => {
  const { db, calls } = fakeDb(reserva());
  // Si la base devolviera el User entero, no debe llegar a la respuesta.
  const create = db.rentalTask.create;
  db.rentalTask.create = async (args) => ({
    ...(await create(args)),
    assignedTo: { id: 'u1', name: 'Ana', phone: '5491100000001', passwordHash: 'x' },
  });

  const resultado = await createTask(valido(), db, HOY);

  const consulta = JSON.stringify([calls.find, calls.create]);
  assert.equal(consulta.includes('passwordHash'), false);
  assert.equal(consulta.includes('phone'), false);
  assert.deepEqual(resultado.task.assignedTo, { id: 'u1', name: 'Ana' });
});

// ---------- createTask: validaciones (400) ----------

test('createTask: sin nombre responde 400, no guarda nada y ni consulta la base', async () => {
  const { resultado, calls } = await crear(valido({ name: '   ' }));

  assert.deepEqual(resultado, { ok: false, status: 400, errors: [NOMBRE_FALTA] });
  assert.equal(calls.create.length, 0);
  assert.equal(calls.find.length, 0);
});

test('createTask: con un nombre de 101 caracteres responde 400 y no guarda nada', async () => {
  const { resultado, calls } = await crear(valido({ name: 'a'.repeat(101) }));

  assert.deepEqual(resultado, { ok: false, status: 400, errors: [NOMBRE_LARGO] });
  assert.equal(calls.create.length, 0);
});

test('createTask: sin responsable responde 400 y no guarda nada', async () => {
  const { resultado, calls } = await crear(valido({ assignedToId: undefined }));

  assert.deepEqual(resultado, { ok: false, status: 400, errors: [RESPONSABLE_FALTA] });
  assert.equal(calls.create.length, 0);
});

test('createTask: sin nombre y sin responsable devuelve los dos errores juntos', async () => {
  const { resultado, calls } = await crear(valido({ name: '', assignedToId: '' }));

  assert.deepEqual(resultado, { ok: false, status: 400, errors: [NOMBRE_FALTA, RESPONSABLE_FALTA] });
  assert.equal(calls.create.length, 0);
});

test('createTask: un responsable que no es copropietario del bien responde 400 y no guarda nada', async () => {
  const { resultado, calls } = await crear(valido({ assignedToId: 'de-otro-bien' }));

  assert.deepEqual(resultado, {
    ok: false,
    status: 400,
    errors: ['El responsable no es copropietario del bien'],
  });
  assert.equal(calls.create.length, 0);
});

// ---------- createTask: el alquiler (404 / 409) ----------

test('createTask: un alquiler que no existe responde 404', async () => {
  const { resultado, calls } = await crear(valido(), null);

  assert.deepEqual(resultado, { ok: false, status: 404, errors: ['No existe el alquiler'] });
  assert.equal(calls.create.length, 0);
});

test('createTask: una reserva de uso (no alquiler) responde 404', async () => {
  const { resultado } = await crear(valido(), reserva({ type: 'USE' }));

  assert.equal(resultado.status, 404);
});

test('createTask: una solicitud a la que le falta un voto responde 409 y no guarda nada', async () => {
  const incompleta = reserva({ approvals: TODOS.slice(0, 3) });

  const { resultado, calls } = await crear(valido(), incompleta);

  assert.deepEqual(resultado, {
    ok: false,
    status: 409,
    errors: ['El alquiler todavía no está aprobado'],
  });
  assert.equal(calls.create.length, 0);
});

test('createTask: una solicitud rechazada responde 409', async () => {
  const rechazada = reserva({ status: 'REJECTED', objections: [{ userId: 'u4' }] });

  assert.equal((await crear(valido(), rechazada)).resultado.status, 409);
});

test('createTask: una objeción la deja afuera aunque el estado guardado no se haya actualizado', async () => {
  const conObjecion = reserva({ status: 'PENDING', objections: [{ userId: 'u4' }] });

  assert.equal((await crear(valido(), conObjecion)).resultado.status, 409);
});

test('createTask: un alquiler cancelado responde 409 aunque tenga todos los votos', async () => {
  // deriveStatus no mira CANCELLED: la lista lo filtra en la consulta, acá hay que rechazarlo.
  const cancelada = reserva({ status: 'CANCELLED', approvals: TODOS });

  assert.equal((await crear(valido(), cancelada)).resultado.status, 409);
});

test('createTask: un alquiler con status ACTIVE se acepta aunque no se lean las aprobaciones', async () => {
  const activa = reserva({ status: 'ACTIVE', approvals: [] });

  assert.equal((await crear(valido(), activa)).resultado.ok, true);
});

// ---------- createTask: la fecha de fin ----------

const terminaEl = (dia) => reserva({ endDate: new Date(`${dia}T00:00:00.000Z`) });

test('createTask: hoy 15/09 un alquiler del 14 al 16 acepta tareas', async () => {
  assert.equal((await crear(valido(), terminaEl('2026-09-16'))).resultado.ok, true);
});

test('createTask: hoy 15/09 un alquiler del 13 al 15 acepta tareas, porque el día de fin todavía cuenta', async () => {
  assert.equal((await crear(valido(), terminaEl('2026-09-15'))).resultado.ok, true);
});

test('createTask: hoy 15/09 un alquiler del 20 al 22, que todavía no empezó, acepta tareas', async () => {
  assert.equal((await crear(valido(), terminaEl('2026-09-22'))).resultado.ok, true);
});

test('createTask: hoy 15/09 un alquiler que terminó el 14 responde 409 y no guarda nada', async () => {
  const { resultado, calls } = await crear(valido(), terminaEl('2026-09-14'));

  assert.deepEqual(resultado, { ok: false, status: 409, errors: ['El alquiler ya terminó'] });
  assert.equal(calls.create.length, 0);
});

test('createTask: a las 23:30 argentinas (ya 16/09 en UTC) el alquiler que termina el 15 todavía acepta tareas', async () => {
  const noche = new Date('2026-09-16T02:30:00.000Z');

  assert.equal((await crear(valido(), terminaEl('2026-09-15'), noche)).resultado.ok, true);
});

test('createTask: a las 00:00 argentinas del 16 el alquiler que terminó el 15 ya no acepta tareas', async () => {
  const medianoche = new Date('2026-09-16T03:00:00.000Z');

  assert.equal((await crear(valido(), terminaEl('2026-09-15'), medianoche)).resultado.status, 409);
});

// ---------- el orden de las reglas ----------

test('createTask: si el alquiler no está aprobado, eso se informa antes que el responsable inválido', async () => {
  const incompleta = reserva({ approvals: [] });

  const { resultado } = await crear(valido({ assignedToId: 'de-otro-bien' }), incompleta);

  assert.equal(resultado.status, 409);
});
