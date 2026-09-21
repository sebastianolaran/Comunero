const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/index');
const reservationService = require('../src/services/reservation.service');

// HU "Consultar calendario": GET /api/reservations?assetId=...&month=YYYY-MM
// Se mockea el service (no prisma): los delegates de Prisma 6 son perezosos
// y node:test no los puede interceptar.

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

  const listForRange = t.mock.method(reservationService, 'listForRange', async () => [reservaMock]);

  const res = await request(app)
    .get('/api/reservations')
    .query({ assetId: 'asset-1', month: '2026-08' });

  assert.equal(res.status, 200);
  assert.equal(res.body.reservations.length, 1);
  assert.equal(res.body.reservations[0].id, 'res-1');

  // El rango pasado al service tiene que cubrir todo agosto en UTC.
  const [assetId, rangeStart, rangeEnd] = listForRange.mock.calls[0].arguments;
  assert.equal(assetId, 'asset-1');
  assert.equal(rangeStart.toISOString(), '2026-08-01T00:00:00.000Z');
  assert.equal(rangeEnd.toISOString(), '2026-08-31T23:59:59.999Z');
});

test('GET /api/reservations con service vacio devuelve lista vacia', async (t) => {
  t.mock.method(reservationService, 'listForRange', async () => []);

  const res = await request(app)
    .get('/api/reservations')
    .query({ assetId: 'asset-sin-reservas', month: '2026-08' });

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { reservations: [] });
});

// HU "Solicitar turno de uso propio": POST /api/reservations

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
  t.mock.method(reservationService, 'hasOverlap', async () => true);
  const requestUse = t.mock.method(reservationService, 'requestUse', async () => {
    throw new Error('no deberia llegar a crear si hay solapamiento');
  });

  const res = await request(app).post('/api/reservations').send({
    assetId: 'asset-1',
    userId: 'user-1',
    startDate: '2026-08-13',
    endDate: '2026-08-15',
  });

  assert.equal(res.status, 409);
  assert.equal(requestUse.mock.calls.length, 0);
});

test('POST /api/reservations con datos validos crea la solicitud en PENDING (reglas 4 y 5)', async (t) => {
  t.mock.method(reservationService, 'hasOverlap', async () => false);

  const reservaCreada = {
    id: 'res-nueva',
    assetId: 'asset-1',
    userId: 'user-1',
    startDate: new Date('2026-08-13T00:00:00.000Z'),
    endDate: new Date('2026-08-15T00:00:00.000Z'),
    type: 'USE',
    status: 'PENDING',
  };
  const requestUse = t.mock.method(reservationService, 'requestUse', async () => reservaCreada);

  const res = await request(app).post('/api/reservations').send({
    assetId: 'asset-1',
    userId: 'user-1',
    startDate: '2026-08-13',
    endDate: '2026-08-15',
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.reservation.status, 'PENDING');
  assert.equal(res.body.reservation.userId, 'user-1');

  // El service recibe el userId del body (regla 4, sin auth todavia) y las
  // fechas ya parseadas a UTC medianoche.
  const [datos] = requestUse.mock.calls[0].arguments;
  assert.equal(datos.userId, 'user-1');
  assert.equal(datos.startDate.toISOString(), '2026-08-13T00:00:00.000Z');
  assert.equal(datos.endDate.toISOString(), '2026-08-15T00:00:00.000Z');
});
