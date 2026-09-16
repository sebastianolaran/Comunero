const test = require('node:test');
const assert = require('node:assert/strict');

const { deriveStatus } = require('../src/services/rentalRequest.service');

// El estado de una solicitud no se guarda: se deriva de los votos YES, la
// cantidad de copropietarios del bien y si hubo algun rechazo.

test('deriveStatus: pendiente mientras faltan votos a favor (1 de 3)', () => {
  assert.equal(deriveStatus({ yesCount: 1, coownerCount: 3, rejectionCount: 0 }), 'PENDING');
});

test('deriveStatus: aprobada cuando votaron a favor todos los copropietarios', () => {
  assert.equal(deriveStatus({ yesCount: 3, coownerCount: 3, rejectionCount: 0 }), 'APPROVED');
});

test('deriveStatus: rechazada si hay un rechazo, aunque otros hayan votado a favor', () => {
  assert.equal(deriveStatus({ yesCount: 2, coownerCount: 3, rejectionCount: 1 }), 'REJECTED');
});

test('deriveStatus: el rechazo gana incluso con todos los votos a favor', () => {
  assert.equal(deriveStatus({ yesCount: 3, coownerCount: 3, rejectionCount: 1 }), 'REJECTED');
});

test('deriveStatus: un bien sin copropietarios nunca aprueba', () => {
  assert.equal(deriveStatus({ yesCount: 0, coownerCount: 0, rejectionCount: 0 }), 'PENDING');
});
