const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/index');
const rentalRequestService = require('../src/services/rentalRequest.service');

const solicitud = {
  id: 'r1',
  renterName: 'Inquilino',
  startDate: '2026-10-10',
  endDate: '2026-10-12',
  yesCount: 3,
  coownerCount: 4,
  status: 'PENDING',
  vote: 'APPROVE',
};

function postVote(body) {
  return request(app).post('/api/rental-requests/r1/votes').send(body);
}

test('POST votes: registra un si y devuelve la solicitud actualizada', async (t) => {
  const vote = t.mock.method(rentalRequestService, 'vote', async () => ({ request: solicitud }));

  const res = await postVote({ userId: 'caro', value: 'APPROVE' });

  assert.equal(res.status, 201);
  assert.deepEqual(res.body, solicitud);
  assert.deepEqual(vote.mock.calls[0].arguments[0], {
    reservationId: 'r1',
    userId: 'caro',
    value: 'APPROVE',
    reason: null,
  });
});

test('POST votes: un no pasa el motivo recortado', async (t) => {
  const vote = t.mock.method(rentalRequestService, 'vote', async () => ({ request: solicitud }));

  const res = await postVote({ userId: 'caro', value: 'REJECT', reason: '  Muy caro  ' });

  assert.equal(res.status, 201);
  assert.equal(vote.mock.calls[0].arguments[0].reason, 'Muy caro');
});

test('POST votes: un no sin motivo responde 400 y no vota', async (t) => {
  const vote = t.mock.method(rentalRequestService, 'vote', async () => ({ request: solicitud }));

  for (const reason of [undefined, '', '   ', 42]) {
    const res = await postVote({ userId: 'caro', value: 'REJECT', reason });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /motivo/i);
  }
  assert.equal(vote.mock.callCount(), 0);
});

test('POST votes: un motivo demasiado largo responde 400', async (t) => {
  const vote = t.mock.method(rentalRequestService, 'vote', async () => ({ request: solicitud }));

  const res = await postVote({ userId: 'caro', value: 'REJECT', reason: 'x'.repeat(501) });

  assert.equal(res.status, 400);
  assert.equal(vote.mock.callCount(), 0);
});

test('POST votes: un valor invalido o sin userId responde 400', async (t) => {
  const vote = t.mock.method(rentalRequestService, 'vote', async () => ({ request: solicitud }));

  for (const body of [{ userId: 'caro', value: 'MAYBE' }, { value: 'APPROVE' }, { userId: '', value: 'APPROVE' }]) {
    const res = await postVote(body);
    assert.equal(res.status, 400);
  }
  assert.equal(vote.mock.callCount(), 0);
});

test('POST votes: sin body responde 400', async (t) => {
  t.mock.method(rentalRequestService, 'vote', async () => ({ request: solicitud }));

  const res = await request(app).post('/api/rental-requests/r1/votes');

  assert.equal(res.status, 400);
});

for (const [error, status] of [
  ['NOT_FOUND', 404],
  ['NOT_COOWNER', 403],
  ['RESOLVED', 409],
]) {
  test(`POST votes: ${error} responde ${status} con un mensaje`, async (t) => {
    t.mock.method(rentalRequestService, 'vote', async () => ({ error }));

    const res = await postVote({ userId: 'caro', value: 'APPROVE' });

    assert.equal(res.status, status);
    assert.ok(res.body.error);
  });
}

test('POST votes: responde 500 si falla la base', async (t) => {
  t.mock.method(rentalRequestService, 'vote', async () => {
    throw new Error('conexion rechazada');
  });
  t.mock.method(console, 'error', () => {});

  const res = await postVote({ userId: 'caro', value: 'APPROVE' });

  assert.equal(res.status, 500);
  assert.ok(res.body.error);
});

test('GET /api/rental-requests pasa el userId para calcular vote', async (t) => {
  const listByAsset = t.mock.method(rentalRequestService, 'listByAsset', async () => [solicitud]);

  const res = await request(app).get('/api/rental-requests?assetId=a1&userId=caro');

  assert.equal(res.status, 200);
  assert.deepEqual(listByAsset.mock.calls[0].arguments, ['a1', 'caro']);
});
