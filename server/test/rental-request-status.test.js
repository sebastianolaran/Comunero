const test = require('node:test');
const assert = require('node:assert/strict');

const { deriveStatus, toListItem } = require('../src/services/rentalRequest.service');

test('deriveStatus: pendiente con 1 de 3 votos a favor', () => {
  assert.equal(deriveStatus({ status: 'PENDING', approvals: 1, objections: 0 }, 3), 'PENDING');
});

test('deriveStatus: pendiente sin ningun voto', () => {
  assert.equal(deriveStatus({ status: 'PENDING', approvals: 0, objections: 0 }, 3), 'PENDING');
});

test('deriveStatus: aprobada cuando votaron a favor los 3 copropietarios', () => {
  assert.equal(deriveStatus({ status: 'PENDING', approvals: 3, objections: 0 }, 3), 'APPROVED');
});

test('deriveStatus: aprobada si el status guardado es ACTIVE', () => {
  assert.equal(deriveStatus({ status: 'ACTIVE', approvals: 0, objections: 0 }, 3), 'APPROVED');
});

test('deriveStatus: rechazada con una objecion, aunque haya votos a favor', () => {
  assert.equal(deriveStatus({ status: 'PENDING', approvals: 2, objections: 1 }, 3), 'REJECTED');
});

test('deriveStatus: rechazada si el status guardado es REJECTED', () => {
  assert.equal(deriveStatus({ status: 'REJECTED', approvals: 0, objections: 0 }, 3), 'REJECTED');
});

test('deriveStatus: un bien sin copropietarios nunca aprueba por votos', () => {
  assert.equal(deriveStatus({ status: 'PENDING', approvals: 0, objections: 0 }, 0), 'PENDING');
});

test('toListItem: arma la solicitud con el interesado, las fechas y el conteo de votos', () => {
  const reservation = {
    id: 'r1',
    status: 'PENDING',
    startDate: new Date('2027-01-10T00:00:00.000Z'),
    endDate: new Date('2027-01-15T00:00:00.000Z'),
    renter: { name: 'Martín Suárez' },
    _count: { approvals: 1, objections: 0 },
  };

  assert.deepEqual(toListItem(reservation, 3), {
    id: 'r1',
    renterName: 'Martín Suárez',
    startDate: '2027-01-10',
    endDate: '2027-01-15',
    yesCount: 1,
    coownerCount: 3,
    status: 'PENDING',
    myVote: null,
  });
});

test('toListItem: myVote refleja el voto del usuario consultado', () => {
  const base = {
    id: 'r3',
    status: 'PENDING',
    startDate: new Date('2027-01-10T00:00:00.000Z'),
    endDate: new Date('2027-01-15T00:00:00.000Z'),
    renter: null,
    _count: { approvals: 1, objections: 0 },
  };

  assert.equal(toListItem({ ...base, approvals: [{ userId: 'u1' }], objections: [] }, 3).myVote, 'APPROVE');
  assert.equal(toListItem({ ...base, approvals: [], objections: [{ userId: 'u1' }] }, 3).myVote, 'REJECT');
  assert.equal(toListItem({ ...base, approvals: [], objections: [] }, 3).myVote, null);
});

test('toListItem: sin interesado cargado devuelve renterName null', () => {
  const reservation = {
    id: 'r2',
    status: 'ACTIVE',
    startDate: new Date('2026-12-01T00:00:00.000Z'),
    endDate: new Date('2026-12-03T00:00:00.000Z'),
    renter: null,
    _count: { approvals: 3, objections: 0 },
  };

  assert.equal(toListItem(reservation, 3).renterName, null);
});
