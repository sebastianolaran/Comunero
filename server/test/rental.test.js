const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/index');
const reservationService = require('../src/services/reservation.service');
const rentalService = require('../src/services/rental.service');

// HU "Solicitar alquiler a terceros": POST /api/reservations/rental
// Se mockean los services (no prisma): los delegates de Prisma 6 son
// perezosos y node:test no los puede interceptar.

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

// El camino feliz: sin solapamiento, con un tercero dado y un requestRental
// que devuelve la reserva y el movimiento por el monto que calculo el
// controller. Devuelve el mock de requestRental para poder inspeccionarlo.
function mockCaminoFeliz(t, renter = { id: 'renter-1', name: 'Familia Perez' }) {
  t.mock.method(reservationService, 'hasOverlap', async () => false);
  t.mock.method(rentalService, 'findOrCreateRenter', async () => renter);

  return t.mock.method(rentalService, 'requestRental', async (datos) => ({
    reservation: {
      id: 'res-1',
      assetId: datos.assetId,
      userId: datos.userId,
      renterId: datos.renterId,
      startDate: datos.startDate,
      endDate: datos.endDate,
      type: 'RENTAL',
      status: 'PENDING',
    },
    movement: { id: 'mov-1', type: 'INCOME', amount: datos.montoTotal },
  }));
}

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
  t.mock.method(reservationService, 'hasOverlap', async () => true);
  const requestRental = t.mock.method(rentalService, 'requestRental', async () => {
    throw new Error('no deberia llegar a crear si hay solapamiento');
  });

  const res = await request(app).post('/api/reservations/rental').send(bodyValido);

  assert.equal(res.status, 409);
  assert.equal(requestRental.mock.calls.length, 0);
});

test('POST /api/reservations/rental con montoModo TOTAL usa el monto tal cual', async (t) => {
  const requestRental = mockCaminoFeliz(t);

  const res = await request(app).post('/api/reservations/rental').send(bodyValido);

  assert.equal(res.status, 201);
  assert.equal(res.body.reservation.type, 'RENTAL');
  assert.equal(res.body.movement.amount, 50000);
  assert.equal(res.body.movement.type, 'INCOME');
  assert.equal(res.body.renter.name, 'Familia Perez');

  const [datos] = requestRental.mock.calls[0].arguments;
  assert.equal(datos.montoTotal, 50000);
});

test('POST /api/reservations/rental con montoModo POR_DIA multiplica por la cantidad de dias', async (t) => {
  const requestRental = mockCaminoFeliz(t);

  // 20/12 al 22/12 = 3 dias, $10.000/dia -> $30.000 (mismo ejemplo de la tarjeta)
  const res = await request(app)
    .post('/api/reservations/rental')
    .send({ ...bodyValido, montoModo: 'POR_DIA', monto: 10000 });

  assert.equal(res.status, 201);
  assert.equal(res.body.movement.amount, 30000);

  const [datos] = requestRental.mock.calls[0].arguments;
  assert.equal(datos.montoTotal, 30000);
});

test('POST /api/reservations/rental usa el Renter que devuelve el service (regla 4)', async (t) => {
  t.mock.method(reservationService, 'hasOverlap', async () => false);
  const findOrCreateRenter = t.mock.method(rentalService, 'findOrCreateRenter', async () => ({
    id: 'renter-existente',
    name: 'Familia Perez',
  }));
  const requestRental = t.mock.method(rentalService, 'requestRental', async (datos) => ({
    reservation: { id: 'res-3', renterId: datos.renterId, type: 'RENTAL' },
    movement: { id: 'mov-3', type: 'INCOME', amount: datos.montoTotal },
  }));

  const res = await request(app)
    .post('/api/reservations/rental')
    .send({ ...bodyValido, renterName: '  Familia Perez  ' });

  assert.equal(res.status, 201);
  assert.equal(res.body.renter.id, 'renter-existente');
  assert.equal(res.body.reservation.renterId, 'renter-existente');

  // El nombre llega al service sin los espacios de los costados.
  const [assetId, nombre, telefono] = findOrCreateRenter.mock.calls[0].arguments;
  assert.equal(assetId, 'asset-1');
  assert.equal(nombre, 'Familia Perez');
  assert.equal(telefono, '5491100000009');
  assert.equal(requestRental.mock.calls.length, 1);
});
