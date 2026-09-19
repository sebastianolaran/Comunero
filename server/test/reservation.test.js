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
