import test from 'node:test'
import assert from 'node:assert/strict'

import { agrupar, daysLabel, formatRange, validarVoto, votosLabel } from '../src/lib/rentalRequests.js'

const pendiente = (id) => ({ id, status: 'PENDING' })
const aprobada = (id) => ({ id, status: 'APPROVED' })
const rechazada = (id) => ({ id, status: 'REJECTED' })

test('agrupar: separa las pendientes de las aprobadas', () => {
  const { pendientes, aprobadas } = agrupar([pendiente('martin'), aprobada('vieja')])

  assert.deepEqual(pendientes.map((s) => s.id), ['martin'])
  assert.deepEqual(aprobadas.map((s) => s.id), ['vieja'])
})

test('agrupar: las rechazadas quedan en la sección de pendientes', () => {
  const { pendientes, aprobadas } = agrupar([rechazada('lucia'), aprobada('vieja')])

  assert.deepEqual(pendientes.map((s) => s.id), ['lucia'])
  assert.deepEqual(aprobadas.map((s) => s.id), ['vieja'])
})

test('agrupar: mantiene el orden de más reciente a más antigua dentro de cada grupo', () => {
  const { pendientes, aprobadas } = agrupar([
    pendiente('p3'),
    aprobada('a3'),
    pendiente('p2'),
    rechazada('r2'),
    aprobada('a1'),
  ])

  assert.deepEqual(pendientes.map((s) => s.id), ['p3', 'p2', 'r2'])
  assert.deepEqual(aprobadas.map((s) => s.id), ['a3', 'a1'])
})

test('agrupar: sin solicitudes devuelve los dos grupos vacíos', () => {
  assert.deepEqual(agrupar([]), { pendientes: [], aprobadas: [] })
})

test('votosLabel: "1 de 3"', () => {
  assert.equal(votosLabel({ yesCount: 1, coownerCount: 3 }), '1 de 3')
})

test('formatRange: rango dentro del mismo mes y año', () => {
  assert.equal(formatRange('2027-01-10', '2027-01-15'), '10 ene – 15 ene 2027')
})

test('formatRange: un solo día', () => {
  assert.equal(formatRange('2026-08-20', '2026-08-20'), '20 ago 2026')
})

test('formatRange: cruza de año', () => {
  assert.equal(formatRange('2026-12-20', '2027-01-03'), '20 dic 2026 – 3 ene 2027')
})

test('daysLabel: cuenta el primer y el último día', () => {
  assert.equal(daysLabel('2027-01-10', '2027-01-15'), '6 días')
})

test('daysLabel: un solo día en singular', () => {
  assert.equal(daysLabel('2026-08-20', '2026-08-20'), '1 día')
})

test('daysLabel: cruza de mes y de año', () => {
  assert.equal(daysLabel('2026-12-30', '2027-01-02'), '4 días')
})

test('validarVoto: un sí no necesita motivo', () => {
  assert.deepEqual(validarVoto({ value: 'APPROVE', reason: '' }), { voto: { value: 'APPROVE' } })
})

test('validarVoto: un no sin motivo devuelve el error pidiendo el motivo', () => {
  for (const reason of ['', '   ', undefined]) {
    const { error, voto } = validarVoto({ value: 'REJECT', reason })
    assert.match(error, /motivo/i)
    assert.equal(voto, undefined)
  }
})

test('validarVoto: un no con motivo lo manda recortado', () => {
  assert.deepEqual(validarVoto({ value: 'REJECT', reason: '  Muy caro ' }), {
    voto: { value: 'REJECT', reason: 'Muy caro' },
  })
})
