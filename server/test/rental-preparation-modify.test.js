const test = require('node:test');
const assert = require('node:assert/strict');

const { updateTask, deleteTask } = require('../src/services/rentalPreparation.service');

// Igual que en el alta: los delegates de Prisma no se pueden mockear, asi que el
// service recibe la "db" por parametro y aca le pasamos una falsa.

const ANA = { id: 'u1', name: 'Ana' };
const BRUNO = { id: 'u2', name: 'Bruno' };
const CARO = { id: 'u3', name: 'Caro' };
const FLOR = { id: 'u4', name: 'Flor' };
const COPROPIETARIOS = [ANA, BRUNO, CARO, FLOR];

// 15/09/2026 12:00 en Argentina (UTC-3).
const HOY = new Date('2026-09-15T15:00:00.000Z');
const alMediodia = (dia) => new Date(`${dia}T15:00:00.000Z`);

// Por defecto: "Cambiar sábanas", pendiente, con Bruno de responsable, en un
// alquiler que termina el 16/09.
function tarea(overrides = {}) {
  return {
    id: 't1',
    name: 'Cambiar sábanas',
    completed: false,
    assignedTo: BRUNO,
    reservation: {
      endDate: new Date('2026-09-16T00:00:00.000Z'),
      asset: { users: COPROPIETARIOS.map(({ id }) => ({ id })) },
    },
    ...overrides,
  };
}

const terminaEl = (dia, overrides = {}) =>
  tarea({
    ...overrides,
    reservation: {
      endDate: new Date(`${dia}T00:00:00.000Z`),
      asset: { users: COPROPIETARIOS.map(({ id }) => ({ id })) },
    },
  });

function fakeDb(existente) {
  const calls = { find: [], update: [], delete: [] };
  const db = {
    rentalTask: {
      findUnique: async (args) => {
        calls.find.push(args);
        return existente;
      },
      update: async (args) => {
        calls.update.push(args);
        const { completed, assignedToId } = args.data;
        return {
          id: existente.id,
          name: existente.name,
          completed: completed ?? existente.completed,
          assignedTo: assignedToId
            ? COPROPIETARIOS.find((u) => u.id === assignedToId)
            : existente.assignedTo,
        };
      },
      delete: async (args) => {
        calls.delete.push(args);
        return { id: existente.id };
      },
    },
  };
  return { db, calls };
}

async function modificar(cambios, existente = tarea(), now = HOY) {
  const { db, calls } = fakeDb(existente);
  const resultado = await updateTask('t1', cambios, db, now);
  return { resultado, calls };
}

async function eliminar(existente = tarea(), now = HOY) {
  const { db, calls } = fakeDb(existente);
  const resultado = await deleteTask('t1', db, now);
  return { resultado, calls };
}

const YA_TERMINO = { ok: false, status: 409, errors: ['El alquiler ya terminó'] };
const NO_EXISTE = { ok: false, status: 404, errors: ['No existe la tarea'] };

// ---------- updateTask: tildar y destildar ----------

test('updateTask: marca la tarea como hecha y guarda cuándo se completó', async () => {
  const { resultado, calls } = await modificar({ completed: true });

  assert.deepEqual(resultado, {
    ok: true,
    task: { id: 't1', name: 'Cambiar sábanas', completed: true, assignedTo: BRUNO },
  });
  assert.deepEqual(calls.update[0].where, { id: 't1' });
  assert.deepEqual(calls.update[0].data, { completed: true, completedAt: HOY });
});

test('updateTask: desmarcar vuelve a pendiente y borra la fecha de cuándo se completó', async () => {
  const { resultado, calls } = await modificar({ completed: false }, tarea({ completed: true }));

  assert.equal(resultado.ok, true);
  assert.equal(resultado.task.completed, false);
  assert.deepEqual(calls.update[0].data, { completed: false, completedAt: null });
});

test('updateTask: hoy 22/12 un alquiler del 20 al 25 deja tildar', async () => {
  const { resultado } = await modificar({ completed: true }, terminaEl('2026-12-25'), alMediodia('2026-12-22'));

  assert.equal(resultado.ok, true);
  assert.equal(resultado.task.completed, true);
});

test('updateTask: hoy 25/12 un alquiler del 20 al 25 deja tildar, porque el día de fin todavía cuenta', async () => {
  const { resultado } = await modificar({ completed: true }, terminaEl('2026-12-25'), alMediodia('2026-12-25'));

  assert.equal(resultado.ok, true);
});

test('updateTask: hoy 15/09 un alquiler del 20 al 22 que todavía no empezó deja tildar', async () => {
  const { resultado } = await modificar({ completed: true }, terminaEl('2026-09-22'));

  assert.equal(resultado.ok, true);
});

test('updateTask: hoy 22/12 un alquiler del 18 al 21 responde 409 y no guarda nada', async () => {
  const { resultado, calls } = await modificar({ completed: true }, terminaEl('2026-12-21'), alMediodia('2026-12-22'));

  assert.deepEqual(resultado, YA_TERMINO);
  assert.equal(calls.update.length, 0);
});

test('updateTask: hoy 22/12 un alquiler del 18 al 21 tampoco deja destildar una tarea hecha', async () => {
  const hecha = terminaEl('2026-12-21', { completed: true });

  const { resultado, calls } = await modificar({ completed: false }, hecha, alMediodia('2026-12-22'));

  assert.deepEqual(resultado, YA_TERMINO);
  assert.equal(calls.update.length, 0);
});

test('updateTask: tildar una tarea que ya está hecha no cambia nada ni pisa cuándo se completó', async () => {
  const { resultado, calls } = await modificar({ completed: true }, tarea({ completed: true }));

  assert.equal(resultado.ok, true);
  assert.equal(resultado.task.completed, true);
  assert.equal(calls.update.length, 0);
});

test('updateTask: destildar una tarea que ya está pendiente no cambia nada', async () => {
  const { resultado, calls } = await modificar({ completed: false });

  assert.equal(resultado.ok, true);
  assert.equal(calls.update.length, 0);
});

test('updateTask: quien tilda no tiene que ser el responsable, cualquier copropietario puede', async () => {
  // La API no recibe quién llama: la tarea de Caro se tilda igual (lo hace Bruno en el ejemplo).
  const deCaro = tarea({ name: 'Revisar pileta y clorar', assignedTo: CARO });

  const { resultado } = await modificar({ completed: true }, deCaro);

  assert.equal(resultado.ok, true);
  assert.deepEqual(resultado.task.assignedTo, CARO);
  assert.equal(resultado.task.completed, true);
});

// ---------- updateTask: cambiar el responsable ----------

test('updateTask: hoy 15/09 elegir a Caro pasa la tarea de Bruno a Caro', async () => {
  const { resultado, calls } = await modificar({ assignedToId: 'u3' });

  assert.deepEqual(resultado.task.assignedTo, CARO);
  assert.deepEqual(calls.update[0].data, { assignedToId: 'u3' });
});

test('updateTask: hoy 16/09 en un alquiler del 14 al 16 todavía deja reasignar, el día de fin cuenta', async () => {
  const { resultado } = await modificar({ assignedToId: 'u3' }, tarea(), alMediodia('2026-09-16'));

  assert.equal(resultado.ok, true);
  assert.deepEqual(resultado.task.assignedTo, CARO);
});

test('updateTask: reasignar una tarea hecha deja al nuevo responsable y la tarea sigue hecha', async () => {
  const { resultado, calls } = await modificar({ assignedToId: 'u3' }, tarea({ completed: true }));

  assert.equal(resultado.task.completed, true);
  assert.deepEqual(resultado.task.assignedTo, CARO);
  assert.equal('completed' in calls.update[0].data, false);
});

test('updateTask: elegir de nuevo al mismo responsable no cambia nada y no da error', async () => {
  const { resultado, calls } = await modificar({ assignedToId: 'u2' });

  assert.deepEqual(resultado, {
    ok: true,
    task: { id: 't1', name: 'Cambiar sábanas', completed: false, assignedTo: BRUNO },
  });
  assert.equal(calls.update.length, 0);
});

test('updateTask: hoy 17/09 en un alquiler del 14 al 16 no reasigna y la tarea sigue con Bruno', async () => {
  const { resultado, calls } = await modificar({ assignedToId: 'u3' }, tarea(), alMediodia('2026-09-17'));

  assert.deepEqual(resultado, YA_TERMINO);
  assert.equal(calls.update.length, 0);
});

test('updateTask: elegir al mismo responsable en un alquiler que ya terminó igual responde 409', async () => {
  const { resultado } = await modificar({ assignedToId: 'u2' }, tarea(), alMediodia('2026-09-17'));

  assert.deepEqual(resultado, YA_TERMINO);
});

test('updateTask: un responsable que no es copropietario del bien responde 400 y no guarda nada', async () => {
  const { resultado, calls } = await modificar({ assignedToId: 'de-otro-bien' });

  assert.deepEqual(resultado, {
    ok: false,
    status: 400,
    errors: ['El responsable no es copropietario del bien'],
  });
  assert.equal(calls.update.length, 0);
});

test('updateTask: tildar y reasignar en el mismo pedido guarda las dos cosas juntas', async () => {
  const { resultado, calls } = await modificar({ completed: true, assignedToId: 'u3' });

  assert.equal(calls.update.length, 1);
  assert.deepEqual(calls.update[0].data, { completed: true, completedAt: HOY, assignedToId: 'u3' });
  assert.equal(resultado.task.completed, true);
  assert.deepEqual(resultado.task.assignedTo, CARO);
});

// ---------- updateTask: forma del body (400) ----------

test('updateTask: un body sin nada para cambiar responde 400 y ni consulta la base', async () => {
  for (const cambios of [{}, undefined, null]) {
    const { resultado, calls } = await modificar(cambios);

    assert.deepEqual(resultado, { ok: false, status: 400, errors: ['No hay nada para modificar'] });
    assert.equal(calls.find.length, 0);
  }
});

test('updateTask: completed que no es booleano responde 400', async () => {
  for (const completed of ['true', 1, 0, null, {}]) {
    const { resultado, calls } = await modificar({ completed });

    assert.deepEqual(resultado, {
      ok: false,
      status: 400,
      errors: ['El estado de la tarea tiene que ser verdadero o falso'],
    });
    assert.equal(calls.find.length, 0);
  }
});

test('updateTask: un responsable vacío o que no es texto responde 400, nunca deja la tarea sin responsable', async () => {
  for (const assignedToId of ['', '   ', null, 7]) {
    const { resultado, calls } = await modificar({ assignedToId });

    assert.deepEqual(resultado, { ok: false, status: 400, errors: ['Falta elegir un responsable'] });
    assert.equal(calls.find.length, 0);
    assert.equal(calls.update.length, 0);
  }
});

test('updateTask: con dos campos inválidos devuelve los dos errores juntos', async () => {
  const { resultado } = await modificar({ completed: 'si', assignedToId: '' });

  assert.equal(resultado.status, 400);
  assert.equal(resultado.errors.length, 2);
});

// ---------- updateTask: la tarea (404) y la base ----------

test('updateTask: una tarea que no existe responde 404', async () => {
  const { resultado, calls } = await modificar({ completed: true }, null);

  assert.deepEqual(resultado, NO_EXISTE);
  assert.equal(calls.update.length, 0);
});

test('updateTask: si la tarea la borraron justo antes de guardar (P2025) responde 404', async () => {
  const { db } = fakeDb(tarea());
  db.rentalTask.update = async () => {
    throw Object.assign(new Error('Record to update not found'), { code: 'P2025' });
  };

  assert.deepEqual(await updateTask('t1', { completed: true }, db, HOY), NO_EXISTE);
});

test('updateTask: cualquier otro error de la base se propaga, no se disfraza de 404', async () => {
  const { db } = fakeDb(tarea());
  db.rentalTask.update = async () => {
    throw new Error('connection refused');
  };

  await assert.rejects(updateTask('t1', { completed: true }, db, HOY), /connection refused/);
});

test('updateTask: el alquiler que terminó se informa antes que un responsable inválido', async () => {
  const { resultado } = await modificar({ assignedToId: 'de-otro-bien' }, tarea(), alMediodia('2026-09-17'));

  assert.equal(resultado.status, 409);
});

test('updateTask: a las 23:30 argentinas (ya 17/09 en UTC) el alquiler que termina el 16 todavía deja modificar', async () => {
  const noche = new Date('2026-09-17T02:30:00.000Z');

  assert.equal((await modificar({ completed: true }, tarea(), noche)).resultado.ok, true);
});

test('updateTask: a las 00:00 argentinas del 17 el alquiler que terminó el 16 ya no deja modificar', async () => {
  const medianoche = new Date('2026-09-17T03:00:00.000Z');

  assert.equal((await modificar({ completed: true }, tarea(), medianoche)).resultado.status, 409);
});

test('updateTask: nunca pide ni devuelve datos sensibles de los usuarios', async () => {
  const { db, calls } = fakeDb(tarea());
  const update = db.rentalTask.update;
  db.rentalTask.update = async (args) => ({
    ...(await update(args)),
    assignedTo: { id: 'u3', name: 'Caro', phone: '5491100000003', passwordHash: 'x' },
  });

  const resultado = await updateTask('t1', { assignedToId: 'u3' }, db, HOY);

  const consulta = JSON.stringify([calls.find, calls.update]);
  assert.equal(consulta.includes('passwordHash'), false);
  assert.equal(consulta.includes('phone'), false);
  assert.deepEqual(resultado.task.assignedTo, { id: 'u3', name: 'Caro' });
});

// ---------- ids que no son de una tarea ----------

// Un id con un byte NUL (o vacío, o larguísimo) hace fallar la consulta en
// Postgres y daría un 500: se responde 404 sin llegar a la base.
const IDS_INVALIDOS = ['\u0000', '', ' ', 'a/b', 'a'.repeat(65), undefined, null, 7, {}];

test('updateTask: un id que no puede ser de una tarea responde 404 sin consultar la base', async () => {
  for (const id of IDS_INVALIDOS) {
    const { db, calls } = fakeDb(tarea());

    assert.deepEqual(await updateTask(id, { completed: true }, db, HOY), NO_EXISTE);
    assert.equal(calls.find.length, 0);
  }
});

test('deleteTask: un id que no puede ser de una tarea responde 404 sin consultar la base', async () => {
  for (const id of IDS_INVALIDOS) {
    const { db, calls } = fakeDb(tarea());

    assert.deepEqual(await deleteTask(id, db, HOY), NO_EXISTE);
    assert.equal(calls.find.length, 0);
    assert.equal(calls.delete.length, 0);
  }
});

test('updateTask: los ids de Prisma (cuid) y los de los tests son ids válidos', async () => {
  for (const id of ['cmu8rj8yi0001tty029dwizyd', 't1', 'seed-tarea_1']) {
    const { db, calls } = fakeDb(tarea());

    await updateTask(id, { completed: true }, db, HOY);

    assert.equal(calls.find.length, 1);
  }
});

// ---------- deleteTask ----------

test('deleteTask: hoy 15/09 en un alquiler del 14 al 16 borra la tarea', async () => {
  const { resultado, calls } = await eliminar();

  assert.deepEqual(resultado, { ok: true });
  assert.deepEqual(calls.delete, [{ where: { id: 't1' } }]);
});

test('deleteTask: hoy 16/09 en un alquiler del 14 al 16 todavía borra, el día de fin cuenta', async () => {
  const { resultado, calls } = await eliminar(tarea(), alMediodia('2026-09-16'));

  assert.deepEqual(resultado, { ok: true });
  assert.equal(calls.delete.length, 1);
});

test('deleteTask: una tarea ya hecha se borra igual que una pendiente', async () => {
  const { resultado, calls } = await eliminar(tarea({ name: 'Limpieza profunda de la casa', completed: true }));

  assert.deepEqual(resultado, { ok: true });
  assert.equal(calls.delete.length, 1);
});

test('deleteTask: quien borra no tiene que ser el responsable', async () => {
  const deCaro = tarea({ name: 'Revisar pileta y clorar', assignedTo: CARO });

  assert.deepEqual((await eliminar(deCaro)).resultado, { ok: true });
});

test('deleteTask: hoy 17/09 en un alquiler del 14 al 16 responde 409 y no borra nada', async () => {
  const { resultado, calls } = await eliminar(tarea(), alMediodia('2026-09-17'));

  assert.deepEqual(resultado, YA_TERMINO);
  assert.equal(calls.delete.length, 0);
});

test('deleteTask: una tarea que no existe responde 404', async () => {
  const { resultado, calls } = await eliminar(null);

  assert.deepEqual(resultado, NO_EXISTE);
  assert.equal(calls.delete.length, 0);
});

test('deleteTask: si otro la borró justo antes (P2025) responde 404', async () => {
  const { db } = fakeDb(tarea());
  db.rentalTask.delete = async () => {
    throw Object.assign(new Error('Record to delete does not exist'), { code: 'P2025' });
  };

  assert.deepEqual(await deleteTask('t1', db, HOY), NO_EXISTE);
});

test('deleteTask: cualquier otro error de la base se propaga', async () => {
  const { db } = fakeDb(tarea());
  db.rentalTask.delete = async () => {
    throw new Error('connection refused');
  };

  await assert.rejects(deleteTask('t1', db, HOY), /connection refused/);
});

test('deleteTask: a las 00:00 argentinas del 17 el alquiler que terminó el 16 ya no deja borrar', async () => {
  const medianoche = new Date('2026-09-17T03:00:00.000Z');

  assert.equal((await eliminar(tarea(), medianoche)).resultado.status, 409);
});
