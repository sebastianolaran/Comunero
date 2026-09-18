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

const COOWNERS = [
  { id: 'u1', name: 'Ana' },
  { id: 'u2', name: 'Bruno' },
  { id: 'u3', name: 'Carla' },
];

function reservationWith(overrides = {}) {
  return {
    id: 'r1',
    status: 'PENDING',
    startDate: new Date('2027-01-10T00:00:00.000Z'),
    endDate: new Date('2027-01-15T00:00:00.000Z'),
    note: 'Somos 4, sin mascotas.',
    renter: { name: 'Martín Suárez', phone: '5491155551234' },
    approvals: [],
    objections: [],
    ...overrides,
  };
}

test('toListItem: arma la solicitud con el interesado, las fechas y el voto de cada copropietario', () => {
  const reservation = reservationWith({ approvals: [{ userId: 'u1' }] });

  assert.deepEqual(toListItem(reservation, COOWNERS, 'u2'), {
    id: 'r1',
    renterName: 'Martín Suárez',
    renterPhone: '5491155551234',
    comments: 'Somos 4, sin mascotas.',
    startDate: '2027-01-10',
    endDate: '2027-01-15',
    yesCount: 1,
    coownerCount: 3,
    status: 'PENDING',
    votes: [
      { userId: 'u1', name: 'Ana', value: 'APPROVE' },
      { userId: 'u2', name: 'Bruno', value: null },
      { userId: 'u3', name: 'Carla', value: null },
    ],
    rejections: [],
    vote: null,
  });
});

test('toListItem: vote es el voto del usuario consultado', () => {
  const reservation = reservationWith({
    approvals: [{ userId: 'u1' }],
    objections: [{ userId: 'u2', reason: 'Ruido' }],
  });

  assert.equal(toListItem(reservation, COOWNERS, 'u1').vote, 'APPROVE');
  assert.equal(toListItem(reservation, COOWNERS, 'u2').vote, 'REJECT');
  assert.equal(toListItem(reservation, COOWNERS, 'u3').vote, null);
  assert.equal(toListItem(reservation, COOWNERS).vote, null);
});

test('toListItem: un rechazo queda como objecion con el nombre y el motivo', () => {
  const reservation = reservationWith({ objections: [{ userId: 'u2', reason: 'Ya hubo quejas por ruido' }] });

  const item = toListItem(reservation, COOWNERS, 'u1');

  assert.equal(item.status, 'REJECTED');
  assert.deepEqual(item.rejections, [{ name: 'Bruno', reason: 'Ya hubo quejas por ruido' }]);
  assert.equal(item.votes[1].value, 'REJECT');
});

test('toListItem: sin interesado ni comentario devuelve null', () => {
  const item = toListItem(reservationWith({ renter: null, note: null }), COOWNERS);

  assert.equal(item.renterName, null);
  assert.equal(item.renterPhone, null);
  assert.equal(item.comments, null);
});
