const test = require('node:test');
const assert = require('node:assert/strict');

const prisma = require('../src/prisma');
const { nextStatus, vote } = require('../src/services/rentalRequest.service');

const COOWNERS = ['ana', 'bruno', 'caro', 'flor'];
const nameOf = (id) => id[0].toUpperCase() + id.slice(1);

// Base en memoria con la forma minima de las queries que hace vote().
function fakeDb({ reservation = {}, users = COOWNERS, approvals = [], objections = [] } = {}) {
  const state = {
    reservation: {
      id: 'r1',
      assetId: 'a1',
      type: 'RENTAL',
      status: 'PENDING',
      startDate: new Date('2026-10-10T00:00:00.000Z'),
      endDate: new Date('2026-10-12T00:00:00.000Z'),
      note: null,
      renter: { name: 'Inquilino', phone: '5491100000000' },
      ...reservation,
    },
    approvals: approvals.map((userId) => ({ userId })),
    objections: objections.map((userId) => ({ userId, reason: 'no' })),
  };
  const snapshot = () => ({ ...state.reservation, approvals: state.approvals, objections: state.objections });
  const byUser = (rows, where) => rows.filter((row) => row.userId === where.userId);

  const tx = {
    $queryRaw: async () => [],
    reservation: {
      findUnique: async ({ where }) => (where.id === state.reservation.id ? snapshot() : null),
      update: async ({ data }) => {
        state.reservation = { ...state.reservation, ...data };
        return state.reservation;
      },
    },
    user: {
      findMany: async ({ where }) =>
        where.assetId === state.reservation.assetId ? users.map((id) => ({ id, name: nameOf(id) })) : [],
    },
    reservationApproval: {
      upsert: async ({ create }) => {
        if (byUser(state.approvals, create).length === 0) {
          state.approvals = [...state.approvals, { userId: create.userId }];
        }
      },
      deleteMany: async ({ where }) => {
        state.approvals = state.approvals.filter((row) => row.userId !== where.userId);
      },
      count: async () => state.approvals.length,
    },
    objection: {
      create: async ({ data }) => {
        state.objections = [...state.objections, { userId: data.userId, reason: data.reason }];
      },
    },
  };

  return { state, tx };
}

// PrismaClient no expone $transaction como metodo propio, asi que t.mock.method
// no lo encuentra: se pisa a mano y se restaura al terminar el test.
function useDb(t, db) {
  const original = prisma.$transaction;
  prisma.$transaction = async (fn) => fn(db.tx);
  t.after(() => {
    prisma.$transaction = original;
  });
}

test('nextStatus: un si que no completa la unanimidad deja la solicitud pendiente', () => {
  assert.equal(nextStatus('APPROVE', 3, 4), 'PENDING');
});

test('nextStatus: el ultimo si aprueba la solicitud', () => {
  assert.equal(nextStatus('APPROVE', 4, 4), 'APPROVED');
});

test('nextStatus: un no rechaza aunque el resto haya votado que si', () => {
  assert.equal(nextStatus('REJECT', 3, 4), 'REJECTED');
});

test('vote: un si sin completar la unanimidad queda registrado y sigue pendiente', async (t) => {
  const db = fakeDb({ approvals: ['ana', 'bruno'] });
  useDb(t, db);

  const result = await vote({ reservationId: 'r1', userId: 'caro', value: 'APPROVE' });

  assert.deepEqual(db.state.approvals.map((a) => a.userId), ['ana', 'bruno', 'caro']);
  assert.equal(db.state.reservation.status, 'PENDING');
  assert.equal(result.request.status, 'PENDING');
  assert.equal(result.request.yesCount, 3);
  assert.equal(result.request.vote, 'APPROVE');
  assert.deepEqual(
    result.request.votes.map((v) => [v.name, v.value]),
    [['Ana', 'APPROVE'], ['Bruno', 'APPROVE'], ['Caro', 'APPROVE'], ['Flor', null]],
  );
});

test('vote: el ultimo si aprueba y guarda la reserva como ACTIVE', async (t) => {
  const db = fakeDb({ approvals: ['ana', 'bruno', 'caro'] });
  useDb(t, db);

  const result = await vote({ reservationId: 'r1', userId: 'flor', value: 'APPROVE' });

  assert.equal(db.state.reservation.status, 'ACTIVE');
  assert.equal(result.request.status, 'APPROVED');
});

test('vote: repetir un si no duplica el voto', async (t) => {
  const db = fakeDb({ approvals: ['ana'] });
  useDb(t, db);

  await vote({ reservationId: 'r1', userId: 'ana', value: 'APPROVE' });

  assert.equal(db.state.approvals.length, 1);
});

test('vote: un no guarda el motivo y rechaza de inmediato', async (t) => {
  const db = fakeDb();
  useDb(t, db);

  const result = await vote({ reservationId: 'r1', userId: 'bruno', value: 'REJECT', reason: 'Muy caro' });

  assert.deepEqual(db.state.objections, [{ userId: 'bruno', reason: 'Muy caro' }]);
  assert.equal(db.state.reservation.status, 'REJECTED');
  assert.equal(result.request.status, 'REJECTED');
  assert.equal(result.request.vote, 'REJECT');
  assert.deepEqual(result.request.rejections, [{ name: 'Bruno', reason: 'Muy caro' }]);
});

test('vote: pasar de si a no reemplaza el voto anterior y rechaza', async (t) => {
  const db = fakeDb({ approvals: ['ana', 'bruno'] });
  useDb(t, db);

  await vote({ reservationId: 'r1', userId: 'bruno', value: 'REJECT', reason: 'Cambie de idea' });

  assert.deepEqual(db.state.approvals.map((a) => a.userId), ['ana']);
  assert.equal(db.state.objections.length, 1);
  assert.equal(db.state.reservation.status, 'REJECTED');
});

test('vote: en una solicitud aprobada no modifica nada', async (t) => {
  const db = fakeDb({ reservation: { status: 'ACTIVE' }, approvals: COOWNERS });
  useDb(t, db);

  const result = await vote({ reservationId: 'r1', userId: 'ana', value: 'REJECT', reason: 'x' });

  assert.deepEqual(result, { error: 'RESOLVED' });
  assert.equal(db.state.approvals.length, 4);
  assert.equal(db.state.objections.length, 0);
});

test('vote: en una solicitud rechazada no registra el voto de quien no habia votado', async (t) => {
  const db = fakeDb({ objections: ['bruno'] });
  useDb(t, db);

  const result = await vote({ reservationId: 'r1', userId: 'flor', value: 'APPROVE' });

  assert.deepEqual(result, { error: 'RESOLVED' });
  assert.equal(db.state.approvals.length, 0);
});

test('vote: responde NOT_FOUND si la solicitud no existe', async (t) => {
  useDb(t, fakeDb());

  assert.deepEqual(await vote({ reservationId: 'nope', userId: 'ana', value: 'APPROVE' }), {
    error: 'NOT_FOUND',
  });
});

test('vote: responde NOT_FOUND si la reserva no es un alquiler', async (t) => {
  useDb(t, fakeDb({ reservation: { type: 'USE' } }));

  assert.deepEqual(await vote({ reservationId: 'r1', userId: 'ana', value: 'APPROVE' }), {
    error: 'NOT_FOUND',
  });
});

test('vote: responde NOT_COOWNER si el usuario no es copropietario del bien', async (t) => {
  const db = fakeDb();
  useDb(t, db);

  const result = await vote({ reservationId: 'r1', userId: 'intruso', value: 'APPROVE' });

  assert.deepEqual(result, { error: 'NOT_COOWNER' });
  assert.equal(db.state.approvals.length, 0);
});
