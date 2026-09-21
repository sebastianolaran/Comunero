const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/index');
const prisma = require('../src/prisma');

// HU "Solicitar alquiler a terceros": POST /api/reservations/rental
// prisma.$transaction se mockea para que ejecute el callback pasandole el
// mismo `prisma` mockeado como `tx` (asi los mocks de
// prisma.reservation.create / prisma.movement.create aplican igual).

function mockTransaccion(t) {
  t.mock.method(prisma, '$transaction', async (fn) => fn(prisma));
}

const bodyValido = {
  assetId: 'asset-1',
  userId: 'user-1',
  startDate: '2026-12-20',
  endDate: '2026-12-22',
  renterName: 'Familia Perez',
  renterPhone: '5491100000009',
  montoModo: 'TOTAL',
  monto: 50000,
};

test('POST /api/reservations/rental sin assetId/userId responde 400', async () => {
  const res = await request(app)
    .post('/api/reservations/rental')
    .send({ ...bodyValido, assetId: undefined });

  assert.equal(res.status, 400);
});

test('POST /api/reservations/rental con startDate == endDate responde 400 (regla 2, estricta)', async () => {
  const res = await request(app)
    .post('/api/reservations/rental')
    .send({ ...bodyValido, startDate: '2026-12-20', endDate: '2026-12-20' });

  assert.equal(res.status, 400);
});

test('POST /api/reservations/rental sin renterName responde 400 (regla 4)', async () => {
  const res = await request(app)
    .post('/api/reservations/rental')
    .send({ ...bodyValido, renterName: '  ' });

  assert.equal(res.status, 400);
});

test('POST /api/reservations/rental con montoModo invalido responde 400 (regla 5)', async () => {
  const res = await request(app)
    .post('/api/reservations/rental')
    .send({ ...bodyValido, montoModo: 'MENSUAL' });

  assert.equal(res.status, 400);
});

test('POST /api/reservations/rental con monto negativo responde 400 (regla 6)', async () => {
  const res = await request(app)
    .post('/api/reservations/rental')
    .send({ ...bodyValido, monto: -10 });

  assert.equal(res.status, 400);
});

test('POST /api/reservations/rental con dias ocupados responde 409 (regla 3)', async (t) => {
  t.mock.method(prisma.reservation, 'count', async () => 1);

  const res = await request(app).post('/api/reservations/rental').send(bodyValido);

  assert.equal(res.status, 409);
});

test('POST /api/reservations/rental con montoModo TOTAL usa el monto tal cual', async (t) => {
  t.mock.method(prisma.reservation, 'count', async () => 0);
  t.mock.method(prisma.renter, 'findFirst', async () => null);
  t.mock.method(prisma.renter, 'create', async ({ data }) => ({ id: 'renter-1', ...data }));
  mockTransaccion(t);
  t.mock.method(prisma.reservation, 'create', async ({ data }) => ({ id: 'res-1', ...data }));
  const crearMovimiento = t.mock.method(prisma.movement, 'create', async ({ data }) => ({
    id: 'mov-1',
    ...data,
  }));

  const res = await request(app).post('/api/reservations/rental').send(bodyValido);

  assert.equal(res.status, 201);
  assert.equal(res.body.reservation.type, 'RENTAL');
  assert.equal(res.body.movement.amount, 50000);
  assert.equal(res.body.movement.type, 'INCOME');
  assert.equal(res.body.renter.name, 'Familia Perez');

  const [{ data }] = crearMovimiento.mock.calls[0].arguments;
  assert.equal(data.amount, 50000);
});

test('POST /api/reservations/rental con montoModo POR_DIA multiplica por la cantidad de dias', async (t) => {
  t.mock.method(prisma.reservation, 'count', async () => 0);
  t.mock.method(prisma.renter, 'findFirst', async () => ({ id: 'renter-1', name: 'Familia Perez' }));
  mockTransaccion(t);
  t.mock.method(prisma.reservation, 'create', async ({ data }) => ({ id: 'res-2', ...data }));
  const crearMovimiento = t.mock.method(prisma.movement, 'create', async ({ data }) => ({
    id: 'mov-2',
    ...data,
  }));

  // 20/12 al 22/12 = 3 dias, $10.000/dia -> $30.000 (mismo ejemplo de la tarjeta)
  const res = await request(app)
    .post('/api/reservations/rental')
    .send({ ...bodyValido, montoModo: 'POR_DIA', monto: 10000 });

  assert.equal(res.status, 201);
  assert.equal(res.body.movement.amount, 30000);

  const [{ data }] = crearMovimiento.mock.calls[0].arguments;
  assert.equal(data.amount, 30000);
});

test('POST /api/reservations/rental reutiliza un Renter existente por nombre', async (t) => {
  t.mock.method(prisma.reservation, 'count', async () => 0);
  const buscarRenter = t.mock.method(prisma.renter, 'findFirst', async () => ({
    id: 'renter-existente',
    name: 'Familia Perez',
  }));
  const crearRenter = t.mock.method(prisma.renter, 'create', async () => {
    throw new Error('no deberia crear un renter nuevo si ya existe uno con ese nombre');
  });
  mockTransaccion(t);
  t.mock.method(prisma.reservation, 'create', async ({ data }) => ({ id: 'res-3', ...data }));
  t.mock.method(prisma.movement, 'create', async ({ data }) => ({ id: 'mov-3', ...data }));

  const res = await request(app).post('/api/reservations/rental').send(bodyValido);

  assert.equal(res.status, 201);
  assert.equal(res.body.renter.id, 'renter-existente');
  assert.equal(buscarRenter.mock.calls.length, 1);
  assert.equal(crearRenter.mock.calls.length, 0);
});
