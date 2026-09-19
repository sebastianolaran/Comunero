const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/index');
const rentalPreparationService = require('../src/services/rentalPreparation.service');

const tareaHecha = {
  id: 't1',
  name: 'Revisar pileta y clorar',
  completed: true,
  assignedTo: { id: 'u3', name: 'Caro' },
};

const yaTermino = { ok: false, status: 409, errors: ['El alquiler ya terminó'] };
const noExiste = { ok: false, status: 404, errors: ['No existe la tarea'] };

// ---------- PATCH /api/rental-preparations/tasks/:id ----------

test('PATCH /tasks/:id modifica la tarea y responde 200 con ella', async (t) => {
  const updateTask = t.mock.method(rentalPreparationService, 'updateTask', async () => ({
    ok: true,
    task: tareaHecha,
  }));

  const res = await request(app).patch('/api/rental-preparations/tasks/t1').send({ completed: true });

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, tareaHecha);
  assert.equal(updateTask.mock.calls[0].arguments[0], 't1');
  assert.deepEqual(updateTask.mock.calls[0].arguments[1], { completed: true });
});

test('PATCH /tasks/:id pasa el nuevo responsable al service', async (t) => {
  const updateTask = t.mock.method(rentalPreparationService, 'updateTask', async () => ({
    ok: true,
    task: tareaHecha,
  }));

  await request(app).patch('/api/rental-preparations/tasks/t1').send({ assignedToId: 'u3' });

  assert.deepEqual(updateTask.mock.calls[0].arguments[1], { assignedToId: 'u3' });
});

test('PATCH /tasks/:id responde 400 con { error, errors } cuando falla la validación', async (t) => {
  t.mock.method(rentalPreparationService, 'updateTask', async () => ({
    ok: false,
    status: 400,
    errors: ['El responsable no es copropietario del bien'],
  }));

  const res = await request(app).patch('/api/rental-preparations/tasks/t1').send({ assignedToId: 'x' });

  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'El responsable no es copropietario del bien');
  assert.deepEqual(res.body.errors, ['El responsable no es copropietario del bien']);
});

test('PATCH /tasks/:id responde 404 si la tarea no existe', async (t) => {
  t.mock.method(rentalPreparationService, 'updateTask', async () => noExiste);

  const res = await request(app).patch('/api/rental-preparations/tasks/nada').send({ completed: true });

  assert.equal(res.status, 404);
  assert.equal(res.body.error, 'No existe la tarea');
});

test('PATCH /tasks/:id responde 409 si el alquiler ya terminó', async (t) => {
  t.mock.method(rentalPreparationService, 'updateTask', async () => yaTermino);

  const res = await request(app).patch('/api/rental-preparations/tasks/t1').send({ completed: true });

  assert.equal(res.status, 409);
  assert.equal(res.body.error, 'El alquiler ya terminó');
});

test('PATCH /tasks/:id sin body no rompe: el service recibe un objeto vacío', async (t) => {
  const updateTask = t.mock.method(rentalPreparationService, 'updateTask', async () => ({
    ok: false,
    status: 400,
    errors: ['No hay nada para modificar'],
  }));

  const res = await request(app).patch('/api/rental-preparations/tasks/t1');

  assert.equal(res.status, 400);
  assert.deepEqual(updateTask.mock.calls[0].arguments[1], {});
});

test('PATCH /tasks/:id responde 400 con { error } si el JSON viene roto', async (t) => {
  const updateTask = t.mock.method(rentalPreparationService, 'updateTask', async () => ({ ok: true }));

  const res = await request(app)
    .patch('/api/rental-preparations/tasks/t1')
    .set('Content-Type', 'application/json')
    .send('{"completed": ');

  assert.equal(res.status, 400);
  assert.ok(res.body.error);
  assert.equal(updateTask.mock.callCount(), 0);
});

test('PATCH /tasks/:id responde 500 sin filtrar detalles si falla la base', async (t) => {
  t.mock.method(rentalPreparationService, 'updateTask', async () => {
    throw new Error('conexion rechazada: postgresql://usuario:secreto@host/db');
  });
  t.mock.method(console, 'error', () => {});

  const res = await request(app).patch('/api/rental-preparations/tasks/t1').send({ completed: true });

  assert.equal(res.status, 500);
  assert.ok(res.body.error);
  assert.equal(JSON.stringify(res.body).includes('secreto'), false);
});

// ---------- DELETE /api/rental-preparations/tasks/:id ----------

test('DELETE /tasks/:id borra la tarea y responde 204 sin cuerpo', async (t) => {
  const deleteTask = t.mock.method(rentalPreparationService, 'deleteTask', async () => ({ ok: true }));

  const res = await request(app).delete('/api/rental-preparations/tasks/t1');

  assert.equal(res.status, 204);
  assert.equal(res.text, '');
  assert.equal(deleteTask.mock.calls[0].arguments[0], 't1');
});

test('DELETE /tasks/:id responde 404 si la tarea no existe', async (t) => {
  t.mock.method(rentalPreparationService, 'deleteTask', async () => noExiste);

  const res = await request(app).delete('/api/rental-preparations/tasks/nada');

  assert.equal(res.status, 404);
  assert.equal(res.body.error, 'No existe la tarea');
});

test('DELETE /tasks/:id responde 409 si el alquiler ya terminó', async (t) => {
  t.mock.method(rentalPreparationService, 'deleteTask', async () => yaTermino);

  const res = await request(app).delete('/api/rental-preparations/tasks/t1');

  assert.equal(res.status, 409);
  assert.deepEqual(res.body, { error: 'El alquiler ya terminó', errors: ['El alquiler ya terminó'] });
});

test('DELETE /tasks/:id responde 500 sin filtrar detalles si falla la base', async (t) => {
  t.mock.method(rentalPreparationService, 'deleteTask', async () => {
    throw new Error('conexion rechazada: postgresql://usuario:secreto@host/db');
  });
  t.mock.method(console, 'error', () => {});

  const res = await request(app).delete('/api/rental-preparations/tasks/t1');

  assert.equal(res.status, 500);
  assert.ok(res.body.error);
  assert.equal(JSON.stringify(res.body).includes('secreto'), false);
});
