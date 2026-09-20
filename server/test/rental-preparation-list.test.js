const test = require('node:test');
const assert = require('node:assert/strict');

const { listByAsset } = require('../src/services/rentalPreparation.service');

// Los delegates de Prisma (prisma.asset, ...) no se pueden mockear con
// t.mock.method, asi que el service recibe la "db" por parametro y aca le
// pasamos una falsa que registra la consulta y devuelve el asset armado.

const COPROPIETARIOS = [
  { id: 'u1', name: 'Ana' },
  { id: 'u2', name: 'Bruno' },
  { id: 'u3', name: 'Carla' },
  { id: 'u4', name: 'Flor' },
];
const ANA = { id: 'u1', name: 'Ana' };

// 15/08/2026 12:00 en Argentina: antes de las fechas que usan estos tests, salvo
// donde se aclara. Sin esto "finished" dependeria del dia en que se corre el test.
const HOY = new Date('2026-08-15T15:00:00.000Z');

function fakeDb(asset) {
  const calls = [];
  const db = {
    asset: {
      findUnique: async (args) => {
        calls.push(args);
        return asset;
      },
    },
  };
  return { db, calls };
}

const aprobadaPor = (ids) => ids.map((userId) => ({ userId }));
const TODOS = COPROPIETARIOS.map((u) => u.id);
const FALTA_UNO = TODOS.slice(0, 3);

let seq = 0;
function tarea(overrides = {}) {
  seq += 1;
  return { id: `t${seq}`, name: `Tarea ${seq}`, completed: false, assignedTo: ANA, ...overrides };
}

// Por defecto: aprobada por todos los copropietarios, sin objeciones y sin tareas.
function reserva(overrides = {}) {
  seq += 1;
  return {
    id: `r${seq}`,
    status: 'PENDING',
    startDate: new Date('2026-08-20T00:00:00.000Z'),
    endDate: new Date('2026-08-20T00:00:00.000Z'),
    renter: { name: `Familia ${seq}` },
    approvals: aprobadaPor(TODOS),
    objections: [],
    tasks: [],
    ...overrides,
  };
}

function asset(reservations, users = COPROPIETARIOS) {
  return { users, reservations };
}

async function listar(reservations, users, now = HOY) {
  const { db } = fakeDb(asset(reservations, users));
  return listByAsset('asset-1', db, now);
}

// ---------- la consulta ----------

test('devuelve null cuando el bien no existe', async () => {
  const { db } = fakeDb(null);

  assert.equal(await listByAsset('no-existe', db), null);
});

test('hace una sola consulta: alquileres del bien, sin los cancelados', async () => {
  const { db, calls } = fakeDb(asset([]));

  await listByAsset('asset-1', db);

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].where, { id: 'asset-1' });
  const where = calls[0].select.reservations.where;
  assert.equal(where.type, 'RENTAL');
  assert.deepEqual(where.status, { not: 'CANCELLED' });
});

test('pide alquileres por fecha de inicio ascendente y tareas en orden de carga', async () => {
  const { db, calls } = fakeDb(asset([]));

  await listByAsset('asset-1', db);

  const { orderBy, select } = calls[0].select.reservations;
  assert.deepEqual(orderBy, [{ startDate: 'asc' }, { id: 'asc' }]);
  assert.deepEqual(select.tasks.orderBy, [{ createdAt: 'asc' }, { id: 'asc' }]);
});

test('no filtra por fecha: los alquileres pasados siguen apareciendo', async () => {
  const pasado = reserva({
    startDate: new Date('2020-01-10T00:00:00.000Z'),
    endDate: new Date('2020-01-12T00:00:00.000Z'),
  });
  const { db, calls } = fakeDb(asset([pasado]));

  const lista = await listByAsset('asset-1', db);

  const where = calls[0].select.reservations.where;
  assert.equal('startDate' in where, false);
  assert.equal('endDate' in where, false);
  assert.equal(lista.length, 1);
});

test('nunca pide ni devuelve datos sensibles de los usuarios', async () => {
  const conDatos = reserva({
    tasks: [tarea({ assignedTo: { id: 'u1', name: 'Ana', phone: '5491100000001', passwordHash: 'x' } })],
  });
  const { db, calls } = fakeDb(asset([conDatos]));

  const lista = await listByAsset('asset-1', db);

  const consulta = JSON.stringify(calls[0]);
  assert.equal(consulta.includes('passwordHash'), false);
  assert.equal(consulta.includes('phone'), false);
  assert.deepEqual(lista[0].tasks[0].assignedTo, { id: 'u1', name: 'Ana' });
});

// ---------- cuáles se consideran aprobados (misma regla que Solicitudes) ----------

test('una solicitud a la que le falta un voto no aparece, aunque tenga tareas', async () => {
  const incompleta = reserva({ approvals: aprobadaPor(FALTA_UNO), tasks: [tarea(), tarea()] });

  assert.deepEqual(await listar([incompleta]), []);
});

test('una solicitud rechazada (REJECTED) no aparece, aunque tenga tareas', async () => {
  const rechazada = reserva({
    status: 'REJECTED',
    approvals: aprobadaPor(['u1', 'u2', 'u3']),
    objections: [{ userId: 'u4' }],
    tasks: [tarea()],
  });

  assert.deepEqual(await listar([rechazada]), []);
});

test('una objeción la deja afuera aunque el estado guardado no se haya actualizado', async () => {
  const conObjecion = reserva({ status: 'PENDING', objections: [{ userId: 'u4' }], tasks: [tarea()] });

  assert.deepEqual(await listar([conObjecion]), []);
});

test('cuando vota el copropietario que faltaba, aparece con su resumen "sin tareas"', async () => {
  const completada = reserva({ approvals: aprobadaPor(TODOS), tasks: [] });

  const lista = await listar([completada]);

  assert.equal(lista.length, 1);
  assert.deepEqual(lista[0].tasks, []);
  assert.deepEqual(lista[0].summary, { total: 0, completed: 0, pending: 0 });
});

test('una solicitud con estado ACTIVE aparece aunque no se lean todas las aprobaciones', async () => {
  // ACTIVE es lo que se guarda al reunir la unanimidad: Solicitudes ya la muestra
  // como aprobada. Sin aprobaciones a la vista, solo el estado la hace aparecer.
  const activa = reserva({ status: 'ACTIVE', approvals: [] });

  assert.equal((await listar([activa])).length, 1);
});

test('una solicitud REJECTED no aparece aunque las aprobaciones estén completas', async () => {
  const rechazada = reserva({ status: 'REJECTED', approvals: aprobadaPor(TODOS) });

  assert.deepEqual(await listar([rechazada]), []);
});

test('si ninguna solicitud está aprobada devuelve la lista vacía', async () => {
  const lista = await listar([reserva({ approvals: aprobadaPor(FALTA_UNO) }), reserva({ approvals: [] })]);

  assert.deepEqual(lista, []);
});

test('un bien sin copropietarios no aprueba nada', async () => {
  assert.deepEqual(await listar([reserva({ approvals: [] })], []), []);
});

// ---------- la tarjeta ----------

test('arma la tarjeta con inquilino, fechas (solo día) y tareas', async () => {
  const gomez = reserva({
    id: 'gomez',
    renter: { name: 'Familia Gómez' },
    startDate: new Date('2026-08-20T00:00:00.000Z'),
    endDate: new Date('2026-08-20T00:00:00.000Z'),
    tasks: [tarea({ id: 'limpieza', name: 'Limpieza previa y revisión de llaves', completed: true })],
  });

  const lista = await listar([gomez]);

  assert.deepEqual(lista, [
    {
      id: 'gomez',
      renterName: 'Familia Gómez',
      startDate: '2026-08-20',
      endDate: '2026-08-20',
      tasks: [
        {
          id: 'limpieza',
          name: 'Limpieza previa y revisión de llaves',
          completed: true,
          assignedTo: { id: 'u1', name: 'Ana' },
        },
      ],
      summary: { total: 1, completed: 1, pending: 0 },
      finished: false,
      coowners: COPROPIETARIOS,
    },
  ]);
});

test('las fechas son solo día, en UTC: la zona horaria no las corre', async () => {
  const cerca = reserva({
    startDate: new Date('2026-09-04T00:00:00.000Z'),
    endDate: new Date('2026-09-06T23:59:59.000Z'),
  });

  const [item] = await listar([cerca]);

  assert.equal(item.startDate, '2026-09-04');
  assert.equal(item.endDate, '2026-09-06');
});

test('un mismo inquilino con dos alquileres aprobados genera dos tarjetas, en el orden recibido', async () => {
  const julio = reserva({
    id: 'julio',
    renter: { name: 'Familia Álvarez' },
    startDate: new Date('2026-07-10T00:00:00.000Z'),
    endDate: new Date('2026-07-12T00:00:00.000Z'),
  });
  const septiembre = reserva({
    id: 'septiembre',
    renter: { name: 'Familia Álvarez' },
    startDate: new Date('2026-09-04T00:00:00.000Z'),
    endDate: new Date('2026-09-06T00:00:00.000Z'),
  });

  const lista = await listar([julio, septiembre]);

  assert.deepEqual(
    lista.map((r) => [r.id, r.renterName]),
    [
      ['julio', 'Familia Álvarez'],
      ['septiembre', 'Familia Álvarez'],
    ],
  );
});

test('un alquiler sin inquilino asociado no rompe: renterName queda en null', async () => {
  const [item] = await listar([reserva({ renter: null })]);

  assert.equal(item.renterName, null);
});

// ---------- tareas y resumen ----------

test('muestra las diez tareas pendientes de Ana, sin tope y en el orden recibido', async () => {
  const tareas = Array.from({ length: 10 }, (_, i) => tarea({ id: `d${i}`, name: `Pendiente ${i}` }));

  const [item] = await listar([reserva({ tasks: tareas })]);

  assert.deepEqual(
    item.tasks.map((t) => t.id),
    tareas.map((t) => t.id),
  );
  assert.ok(item.tasks.every((t) => t.assignedTo.name === 'Ana'));
  assert.deepEqual(item.summary, { total: 10, completed: 0, pending: 10 });
});

test('resumen con una tarea hecha y tres pendientes: 3 pendientes de 4', async () => {
  const tareas = [tarea({ completed: true }), tarea(), tarea(), tarea()];

  const [item] = await listar([reserva({ tasks: tareas })]);

  assert.deepEqual(item.summary, { total: 4, completed: 1, pending: 3 });
  assert.deepEqual(
    item.tasks.map((t) => t.completed),
    [true, false, false, false],
  );
});

test('resumen con todas las tareas hechas: sin pendientes', async () => {
  const [item] = await listar([reserva({ tasks: [tarea({ completed: true }), tarea({ completed: true })] })]);

  assert.deepEqual(item.summary, { total: 2, completed: 2, pending: 0 });
});

test('el resumen se recalcula al leer: cuatro tareas con tres hechas deja una pendiente', async () => {
  const tareas = [
    tarea({ completed: true }),
    tarea({ completed: true }),
    tarea({ completed: true }),
    tarea({ completed: false }),
  ];

  const [item] = await listar([reserva({ tasks: tareas })]);

  assert.deepEqual(item.summary, { total: 4, completed: 3, pending: 1 });
});

// ---------- copropietarios para el desplegable de responsable ----------

test('pide los copropietarios del bien con id y nombre, ordenados por nombre', async () => {
  const { db, calls } = fakeDb(asset([]));

  await listByAsset('asset-1', db, HOY);

  assert.deepEqual(calls[0].select.users, { select: { id: true, name: true }, orderBy: { name: 'asc' } });
});

test('cada alquiler trae la lista de copropietarios, sin datos sensibles', async () => {
  const conDatos = COPROPIETARIOS.map((u) => ({ ...u, phone: '5491100000000', passwordHash: 'x' }));

  const [item] = await listar([reserva()], conDatos);

  // Si el service pasara el User entero, se colarían el phone y el hash.
  assert.deepEqual(item.coowners, COPROPIETARIOS);
});

// ---------- si el alquiler ya terminó (fecha de Argentina) ----------

const conFin = (dia) => reserva({ endDate: new Date(`${dia}T00:00:00.000Z`) });
const finished = async (dia, now) => (await listar([conFin(dia)], undefined, now))[0].finished;

test('finished: un alquiler que termina hoy todavía no terminó (el día de fin cuenta)', async () => {
  assert.equal(await finished('2026-09-15', new Date('2026-09-15T15:00:00.000Z')), false);
});

test('finished: un alquiler que termina mañana o que todavía no empezó no terminó', async () => {
  assert.equal(await finished('2026-09-16', new Date('2026-09-15T15:00:00.000Z')), false);
  assert.equal(await finished('2026-09-22', new Date('2026-09-15T15:00:00.000Z')), false);
});

test('finished: un alquiler que terminó ayer ya terminó', async () => {
  assert.equal(await finished('2026-09-14', new Date('2026-09-15T15:00:00.000Z')), true);
});

test('finished: a las 23:30 argentinas (16/09 en UTC) el alquiler que termina el 15 no terminó', async () => {
  assert.equal(await finished('2026-09-15', new Date('2026-09-16T02:30:00.000Z')), false);
});

test('finished: a las 00:00 argentinas del 16 el alquiler que terminó el 15 ya terminó', async () => {
  assert.equal(await finished('2026-09-15', new Date('2026-09-16T03:00:00.000Z')), true);
});

test('los alquileres que terminaron siguen en la lista, marcados como terminados', async () => {
  const lista = await listar([conFin('2026-07-12'), conFin('2026-09-06')], undefined, new Date('2026-09-10T15:00:00.000Z'));

  assert.deepEqual(
    lista.map((r) => r.finished),
    [true, true],
  );
});
