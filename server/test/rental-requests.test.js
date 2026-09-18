const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/index');
const rentalRequestService = require('../src/services/rentalRequest.service');

const martin = {
  id: 'r1',
  renterName: 'Martín Suárez',
  startDate: '2027-01-10',
  endDate: '2027-01-15',
  yesCount: 1,
  coownerCount: 3,
  status: 'PENDING',
};

test('GET /api/rental-requests devuelve las solicitudes del bien', async (t) => {
  const listByAsset = t.mock.method(rentalRequestService, 'listByAsset', async () => [martin]);

  const res = await request(app).get('/api/rental-requests?assetId=a1');

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, [martin]);
  assert.equal(listByAsset.mock.calls[0].arguments[0], 'a1');
});

test('GET /api/rental-requests devuelve [] si el bien no tiene solicitudes', async (t) => {
  t.mock.method(rentalRequestService, 'listByAsset', async () => []);

  const res = await request(app).get('/api/rental-requests?assetId=a1');

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, []);
});

test('GET /api/rental-requests responde 400 sin assetId', async (t) => {
  const listByAsset = t.mock.method(rentalRequestService, 'listByAsset', async () => []);

  const res = await request(app).get('/api/rental-requests');

  assert.equal(res.status, 400);
  assert.ok(res.body.error);
  assert.equal(listByAsset.mock.callCount(), 0);
});

test('GET /api/rental-requests responde 400 si assetId viene repetido', async (t) => {
  const listByAsset = t.mock.method(rentalRequestService, 'listByAsset', async () => []);

  const res = await request(app).get('/api/rental-requests?assetId=a1&assetId=a2');

  assert.equal(res.status, 400);
  assert.equal(listByAsset.mock.callCount(), 0);
});

test('GET /api/rental-requests responde 404 si el bien no existe', async (t) => {
  t.mock.method(rentalRequestService, 'listByAsset', async () => null);

  const res = await request(app).get('/api/rental-requests?assetId=nope');

  assert.equal(res.status, 404);
  assert.ok(res.body.error);
});

test('GET /api/rental-requests responde 500 si falla la base', async (t) => {
  t.mock.method(rentalRequestService, 'listByAsset', async () => {
    throw new Error('conexion rechazada');
  });
  t.mock.method(console, 'error', () => {}); // el controller loguea el error; lo silenciamos en el test

  const res = await request(app).get('/api/rental-requests?assetId=a1');

  assert.equal(res.status, 500);
  assert.ok(res.body.error);
});
