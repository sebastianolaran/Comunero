import test from 'node:test'
import assert from 'node:assert/strict'

import { formatRange, resumenEstado, resumenLabel } from '../src/lib/rentalPreparations.js'

// ---------- formatRange ----------

test('formatRange: un alquiler de un solo día muestra únicamente esa fecha', () => {
  assert.equal(formatRange('2026-08-20', '2026-08-20'), '20 ago 2026')
})

test('formatRange: sin fecha de fin es un solo día', () => {
  assert.equal(formatRange('2026-08-20'), '20 ago 2026')
})

test('formatRange: un rango del mismo año muestra inicio y fin, con el año una sola vez', () => {
  assert.equal(formatRange('2026-09-04', '2026-09-06'), '4 sep – 6 sep 2026')
})

test('formatRange: un rango que cruza de mes', () => {
  assert.equal(formatRange('2026-07-30', '2026-08-02'), '30 jul – 2 ago 2026')
})

test('formatRange: un rango que cruza de año muestra el año en las dos fechas', () => {
  assert.equal(formatRange('2026-12-30', '2027-01-02'), '30 dic 2026 – 2 ene 2027')
})

test('formatRange: cada mes del año tiene su abreviatura de tres letras', () => {
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  meses.forEach((mes, i) => {
    const fecha = `2026-${String(i + 1).padStart(2, '0')}-15`
    assert.equal(formatRange(fecha, fecha), `15 ${mes} 2026`)
  })
})

test('formatRange: no depende de la zona horaria (las fechas se parsean a mano)', () => {
  assert.equal(formatRange('2026-01-01', '2026-01-01'), '1 ene 2026')
})

// ---------- resumenLabel ----------

test('resumenLabel: sin tareas dice "Sin tareas asignadas", sin contador ni "Todo listo"', () => {
  const texto = resumenLabel({ total: 0, completed: 0, pending: 0 })

  assert.equal(texto, 'Sin tareas asignadas')
  assert.equal(texto.includes('Todo listo'), false)
  assert.equal(/\d/.test(texto), false)
})

test('resumenLabel: con tareas sin hacer dice cuántas quedan de cuántas hay', () => {
  assert.equal(resumenLabel({ total: 4, completed: 1, pending: 3 }), '3 pendientes de 4')
})

test('resumenLabel: con una sola pendiente usa el singular', () => {
  assert.equal(resumenLabel({ total: 4, completed: 3, pending: 1 }), '1 pendiente de 4')
})

test('resumenLabel: con todas hechas dice "Todo listo" y la cuenta', () => {
  assert.equal(resumenLabel({ total: 1, completed: 1, pending: 0 }), 'Todo listo (1/1)')
  assert.equal(resumenLabel({ total: 2, completed: 2, pending: 0 }), 'Todo listo (2/2)')
})

test('resumenLabel: un alquiler que estaba "Todo listo" y suma una tarea sin hacer vuelve a mostrar pendientes', () => {
  assert.equal(resumenLabel({ total: 4, completed: 3, pending: 1 }).startsWith('Todo listo'), false)
})

// ---------- resumenEstado ----------

test('resumenEstado: distingue sin tareas, con pendientes y todo listo', () => {
  assert.equal(resumenEstado({ total: 0, completed: 0, pending: 0 }), 'sin-tareas')
  assert.equal(resumenEstado({ total: 4, completed: 1, pending: 3 }), 'pendientes')
  assert.equal(resumenEstado({ total: 2, completed: 2, pending: 0 }), 'listo')
})
