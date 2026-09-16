const test = require('node:test');
const assert = require('node:assert/strict');

const { deriveStatus } = require('../src/services/rentalRequest.service');

// El estado de una solicitud no se guarda: se deriva de los votos (YES / NO)
// y de la cantidad de copropietarios del bien, igual que requestStatus() del
// prototipo.

test('deriveStatus: pendiente mientras faltan votos a favor (1 de 3)', () => {
  assert.equal(deriveStatus(['YES'], 3), 'PENDING');
});

test('deriveStatus: pendiente sin ningun voto', () => {
  assert.equal(deriveStatus([], 3), 'PENDING');
});

test('deriveStatus: aprobada cuando votaron a favor todos los copropietarios', () => {
  assert.equal(deriveStatus(['YES', 'YES', 'YES'], 3), 'APPROVED');
});

test('deriveStatus: rechazada con un voto NO, aunque otros hayan votado a favor', () => {
  assert.equal(deriveStatus(['YES', 'NO', 'YES'], 3), 'REJECTED');
});

test('deriveStatus: un bien sin copropietarios nunca aprueba', () => {
  assert.equal(deriveStatus([], 0), 'PENDING');
});
