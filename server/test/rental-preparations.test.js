const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/index');
const rentalPreparationService = require('../src/services/rentalPreparation.service');

const gomez = {
  id: 'r1',
  renterName: 'Familia Gómez',
  startDate: '2026-08-20',
  endDate: '2026-08-20',
  tasks: [
    {
      id: 't1',
      name: 'Limpieza previa y revisión de llaves',
      completed: true,
      assignedTo: { id: 'u1', name: 'Ana' },
    },
  ],
  summary: { total: 1, completed: 1, pending: 0 },
};

test('GET /api/rental-preparations devuelve los alquileres aprobados del bien', async (t) => {
  const listByAsset = t.mock.method(rentalPreparationService, 'listByAsset', async () => [gomez]);

  const res = await request(app).get('/api/rental-preparations?assetId=a1');

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, [gomez]);
  assert.equal(listByAsset.mock.calls[0].arguments[0], 'a1');
});

test('GET /api/rental-preparations devuelve [] si el bien no tiene alquileres aprobados', async (t) => {
  t.mock.method(rentalPreparationService, 'listByAsset', async () => []);

  const res = await request(app).get('/api/rental-preparations?assetId=a1');

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, []);
});

test('GET /api/rental-preparations responde 400 sin assetId', async (t) => {
  const listByAsset = t.mock.method(rentalPreparationService, 'listByAsset', async () => []);

  const res = await request(app).get('/api/rental-preparations');

  assert.equal(res.status, 400);
  assert.ok(res.body.error);
  assert.equal(listByAsset.mock.callCount(), 0);
});

test('GET /api/rental-preparations responde 400 si assetId viene vacío', async (t) => {
  const listByAsset = t.mock.method(rentalPreparationService, 'listByAsset', async () => []);

  const res = await request(app).get('/api/rental-preparations?assetId=%20');

  assert.equal(res.status, 400);
  assert.equal(listByAsset.mock.callCount(), 0);
});

test('GET /api/rental-preparations responde 400 si assetId viene repetido', async (t) => {
  const listByAsset = t.mock.method(rentalPreparationService, 'listByAsset', async () => []);

  const res = await request(app).get('/api/rental-preparations?assetId=a1&assetId=a2');

  assert.equal(res.status, 400);
  assert.equal(listByAsset.mock.callCount(), 0);
});

test('GET /api/rental-preparations responde 404 si el bien no existe', async (t) => {
  t.mock.method(rentalPreparationService, 'listByAsset', async () => null);

  const res = await request(app).get('/api/rental-preparations?assetId=nope');

  assert.equal(res.status, 404);
  assert.ok(res.body.error);
});

test('GET /api/rental-preparations responde 500 sin filtrar detalles si falla la base', async (t) => {
  t.mock.method(rentalPreparationService, 'listByAsset', async () => {
    throw new Error('conexion rechazada: postgresql://usuario:secreto@host/db');
  });
  t.mock.method(console, 'error', () => {}); // el controller loguea el error; lo silenciamos en el test

  const res = await request(app).get('/api/rental-preparations?assetId=a1');

  assert.equal(res.status, 500);
  assert.ok(res.body.error);
  assert.equal(JSON.stringify(res.body).includes('secreto'), false);
});

// ---------- POST /api/rental-preparations/tasks ----------

const tareaCreada = {
  id: 't9',
  name: 'Sacar la basura',
  completed: false,
  assignedTo: { id: 'u3', name: 'Carla' },
};
const cuerpo = { reservationId: 'r1', name: 'Sacar la basura', assignedToId: 'u3' };

test('POST /api/rental-preparations/tasks crea la tarea y responde 201 con ella', async (t) => {
  const createTask = t.mock.method(rentalPreparationService, 'createTask', async () => ({
    ok: true,
    task: tareaCreada,
  }));

  const res = await request(app).post('/api/rental-preparations/tasks').send(cuerpo);

  assert.equal(res.status, 201);
  assert.deepEqual(res.body, tareaCreada);
  assert.deepEqual(createTask.mock.calls[0].arguments[0], cuerpo);
});

test('POST /api/rental-preparations/tasks responde 400 con { error, errors } cuando falla la validación', async (t) => {
  t.mock.method(rentalPreparationService, 'createTask', async () => ({
    ok: false,
    status: 400,
    errors: ['Falta el nombre de la tarea', 'Falta elegir un responsable'],
  }));

  const res = await request(app).post('/api/rental-preparations/tasks').send({ reservationId: 'r1' });

  assert.equal(res.status, 400);
  assert.deepEqual(res.body.errors, ['Falta el nombre de la tarea', 'Falta elegir un responsable']);
  assert.equal(res.body.error, 'Falta el nombre de la tarea. Falta elegir un responsable');
});

test('POST /api/rental-preparations/tasks responde 409 si el alquiler no está aprobado o ya terminó', async (t) => {
  t.mock.method(rentalPreparationService, 'createTask', async () => ({
    ok: false,
    status: 409,
    errors: ['El alquiler ya terminó'],
  }));

  const res = await request(app).post('/api/rental-preparations/tasks').send(cuerpo);

  assert.equal(res.status, 409);
  assert.equal(res.body.error, 'El alquiler ya terminó');
});

test('POST /api/rental-preparations/tasks responde 404 si el alquiler no existe', async (t) => {
  t.mock.method(rentalPreparationService, 'createTask', async () => ({
    ok: false,
    status: 404,
    errors: ['No existe el alquiler'],
  }));

  const res = await request(app).post('/api/rental-preparations/tasks').send(cuerpo);

  assert.equal(res.status, 404);
  assert.ok(res.body.error);
});

test('POST /api/rental-preparations/tasks sin body no rompe: el service recibe un objeto vacío', async (t) => {
  const createTask = t.mock.method(rentalPreparationService, 'createTask', async () => ({
    ok: false,
    status: 400,
    errors: ['Falta el alquiler'],
  }));

  const res = await request(app).post('/api/rental-preparations/tasks');

  assert.equal(res.status, 400);
  assert.deepEqual(createTask.mock.calls[0].arguments[0], {});
});

test('POST /api/rental-preparations/tasks responde 400 con { error } si el JSON viene roto', async (t) => {
  const createTask = t.mock.method(rentalPreparationService, 'createTask', async () => ({ ok: true }));

  const res = await request(app)
    .post('/api/rental-preparations/tasks')
    .set('Content-Type', 'application/json')
    .send('{"reservationId": ');

  assert.equal(res.status, 400);
  assert.ok(res.body.error);
  assert.equal(createTask.mock.callCount(), 0);
});

test('POST /api/rental-preparations/tasks responde 500 sin filtrar detalles si falla la base', async (t) => {
  t.mock.method(rentalPreparationService, 'createTask', async () => {
    throw new Error('conexion rechazada: postgresql://usuario:secreto@host/db');
  });
  t.mock.method(console, 'error', () => {});

  const res = await request(app).post('/api/rental-preparations/tasks').send(cuerpo);

  assert.equal(res.status, 500);
  assert.ok(res.body.error);
  assert.equal(JSON.stringify(res.body).includes('secreto'), false);
});
