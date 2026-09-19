const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/index');
const prisma = require('../src/prisma');

// HU "Consultar calendario": GET /api/reservations?assetId=...&month=YYYY-MM
// Se mockea prisma.reservation.findMany para no depender de una base real
// (mismo enfoque que test/health-db.test.js).

test('GET /api/reservations sin assetId responde 400', async () => {
  const res = await request(app).get('/api/reservations').query({ month: '2026-08' });

  assert.equal(res.status, 400);
});

test('GET /api/reservations con month invalido responde 400', async () => {
  const res = await request(app)
    .get('/api/reservations')
    .query({ assetId: 'asset-1', month: '2026-13' });

  assert.equal(res.status, 400);
});

test('GET /api/reservations sin month responde 400', async () => {
  const res = await request(app).get('/api/reservations').query({ assetId: 'asset-1' });

  assert.equal(res.status, 400);
});

test('GET /api/reservations con parametros validos devuelve las reservas del service', async (t) => {
  const reservaMock = {
    id: 'res-1',
    userId: 'user-1',
    renterId: null,
    startDate: new Date('2026-08-10T00:00:00.000Z'),
    endDate: new Date('2026-08-12T00:00:00.000Z'),
    type: 'USE',
    status: 'ACTIVE',
  };

  t.mock.method(prisma.reservation, 'findMany', async () => [reservaMock]);

  const res = await request(app)
    .get('/api/reservations')
    .query({ assetId: 'asset-1', month: '2026-08' });

  assert.equal(res.status, 200);
  assert.equal(res.body.reservations.length, 1);
  assert.equal(res.body.reservations[0].id, 'res-1');

  // El rango pasado al service tiene que cubrir todo agosto en UTC.
  const [where] = prisma.reservation.findMany.mock.calls[0].arguments;
  assert.equal(where.where.assetId, 'asset-1');
  assert.equal(where.where.startDate.lte.toISOString(), '2026-08-31T23:59:59.999Z');
  assert.equal(where.where.endDate.gte.toISOString(), '2026-08-01T00:00:00.000Z');
});

test('GET /api/reservations con service vacio devuelve lista vacia', async (t) => {
  t.mock.method(prisma.reservation, 'findMany', async () => []);

  const res = await request(app)
    .get('/api/reservations')
    .query({ assetId: 'asset-sin-reservas', month: '2026-08' });

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { reservations: [] });
});

// HU "Solicitar turno de uso propio": POST /api/reservations
// Se mockea prisma.reservation.count (chequeo de solapamiento) y
// prisma.reservation.create.

test('POST /api/reservations sin assetId/userId responde 400', async () => {
  const res = await request(app)
    .post('/api/reservations')
    .send({ startDate: '2026-08-13', endDate: '2026-08-15' });

  assert.equal(res.status, 400);
});

test('POST /api/reservations sin fechas responde 400', async () => {
  const res = await request(app)
    .post('/api/reservations')
    .send({ assetId: 'asset-1', userId: 'user-1' });

  assert.equal(res.status, 400);
});

test('POST /api/reservations con startDate posterior a endDate responde 400 (regla 2)', async () => {
  const res = await request(app).post('/api/reservations').send({
    assetId: 'asset-1',
    userId: 'user-1',
    startDate: '2026-08-15',
    endDate: '2026-08-13',
  });

  assert.equal(res.status, 400);
});

test('POST /api/reservations con dias ya ocupados responde 409 (regla 3)', async (t) => {
  t.mock.method(prisma.reservation, 'count', async () => 1);
  const crear = t.mock.method(prisma.reservation, 'create', async () => {
    throw new Error('no deberia llegar a crear si hay solapamiento');
  });

  const res = await request(app).post('/api/reservations').send({
    assetId: 'asset-1',
    userId: 'user-1',
    startDate: '2026-08-13',
    endDate: '2026-08-15',
  });

  assert.equal(res.status, 409);
  assert.equal(crear.mock.calls.length, 0);
});

test('POST /api/reservations con datos validos crea la solicitud en PENDING (reglas 4 y 5)', async (t) => {
  t.mock.method(prisma.reservation, 'count', async () => 0);

  const reservaCreada = {
    id: 'res-nueva',
    assetId: 'asset-1',
    userId: 'user-1',
    startDate: new Date('2026-08-13T00:00:00.000Z'),
    endDate: new Date('2026-08-15T00:00:00.000Z'),
    type: 'USE',
    status: 'PENDING',
  };
  t.mock.method(prisma.reservation, 'create', async () => reservaCreada);

  const res = await request(app).post('/api/reservations').send({
    assetId: 'asset-1',
    userId: 'user-1',
    startDate: '2026-08-13',
    endDate: '2026-08-15',
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.reservation.status, 'PENDING');
  assert.equal(res.body.reservation.userId, 'user-1');

  // El create tiene que haber pedido type USE explicitamente (uso propio,
  // no alquiler) y el userId del body (regla 4, sin auth todavia).
  const [{ data }] = prisma.reservation.create.mock.calls[0].arguments;
  assert.equal(data.type, 'USE');
  assert.equal(data.userId, 'user-1');
});
