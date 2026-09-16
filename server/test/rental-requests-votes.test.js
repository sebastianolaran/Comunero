const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/index');
const prisma = require('../src/prisma');

// A diferencia de rental-requests.test.js, aca corre el service real: se
// mockea solo Prisma, para probar que el estado y el conteo de votos salen
// bien calculados de los votos guardados. El bien tiene 4 copropietarios.

const COOWNERS = 4;

function solicitud(votes) {
  return {
    id: 'rr1',
    tenantName: 'Javier Peralta',
    contact: 'javier.peralta@mail.com',
    startDate: new Date('2026-09-11T00:00:00Z'),
    endDate: new Date('2026-09-14T00:00:00Z'),
    votes: votes.map((value) => ({ value })),
  };
}

function mockBase(t, requests) {
  t.mock.property(prisma, 'asset', {
    findUnique: async () => ({ _count: { coowners: COOWNERS } }),
  });
  t.mock.property(prisma, 'rentalRequest', {
    findMany: async () => requests,
  });
}

async function listar() {
  const res = await request(app).get('/api/rental-requests?assetId=quinta');
  assert.equal(res.status, 200);
  return res.body;
}

test('solicitud sin votos: pendiente con 0 votos a favor', async (t) => {
  mockBase(t, [solicitud([])]);

  const [r] = await listar();

  assert.deepEqual(r, {
    id: 'rr1',
    tenantName: 'Javier Peralta',
    contact: 'javier.peralta@mail.com',
    startDate: '2026-09-11',
    endDate: '2026-09-14',
    yesCount: 0,
    coownerCount: COOWNERS,
    status: 'PENDING',
  });
});

test('solicitud con 1 de 4 votos a favor: sigue pendiente', async (t) => {
  mockBase(t, [solicitud(['YES'])]);

  const [r] = await listar();

  assert.equal(r.status, 'PENDING');
  assert.equal(r.yesCount, 1);
  assert.equal(r.coownerCount, 4);
});

test('solicitud con los 4 votos a favor: aprobada', async (t) => {
  mockBase(t, [solicitud(['YES', 'YES', 'YES', 'YES'])]);

  const [r] = await listar();

  assert.equal(r.status, 'APPROVED');
  assert.equal(r.yesCount, 4);
});

test('solicitud con un voto NO: rechazada aunque otros hayan votado a favor', async (t) => {
  mockBase(t, [solicitud(['YES', 'YES', 'NO'])]);

  const [r] = await listar();

  assert.equal(r.status, 'REJECTED');
  assert.equal(r.yesCount, 2);
});

test('bien sin solicitudes: responde []', async (t) => {
  mockBase(t, []);

  assert.deepEqual(await listar(), []);
});
