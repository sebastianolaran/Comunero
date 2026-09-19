import test from 'node:test'
import assert from 'node:assert/strict'

import {
  agregarTarea,
  formatRange,
  mensajesDeRespuesta,
  resumenEstado,
  resumenLabel,
  validarTarea,
} from '../src/lib/rentalPreparations.js'

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

// ---------- validarTarea (mismos mensajes que el server) ----------

const NOMBRE_FALTA = 'Falta el nombre de la tarea'
const NOMBRE_LARGO = 'El nombre no puede superar los 100 caracteres'
const RESPONSABLE_FALTA = 'Falta elegir un responsable'

test('validarTarea: un nombre y un responsable no dan errores', () => {
  assert.deepEqual(validarTarea({ nombre: 'Revisar pileta', responsableId: 'u1' }), [])
})

test('validarTarea: nombre vacío o de solo espacios da el error de nombre', () => {
  assert.deepEqual(validarTarea({ nombre: '', responsableId: 'u1' }), [NOMBRE_FALTA])
  assert.deepEqual(validarTarea({ nombre: '     ', responsableId: 'u1' }), [NOMBRE_FALTA])
})

test('validarTarea: 100 caracteres pasan y 101 no', () => {
  assert.deepEqual(validarTarea({ nombre: 'a'.repeat(100), responsableId: 'u1' }), [])
  assert.deepEqual(validarTarea({ nombre: 'a'.repeat(101), responsableId: 'u1' }), [NOMBRE_LARGO])
})

test('validarTarea: los espacios de los extremos no cuentan para el largo', () => {
  assert.deepEqual(validarTarea({ nombre: `  ${'a'.repeat(100)}  `, responsableId: 'u1' }), [])
})

test('validarTarea: un emoji cuenta como un carácter, igual que en el server', () => {
  assert.deepEqual(validarTarea({ nombre: '😀'.repeat(100), responsableId: 'u1' }), [])
  assert.deepEqual(validarTarea({ nombre: '😀'.repeat(101), responsableId: 'u1' }), [NOMBRE_LARGO])
})

test('validarTarea: sin responsable elegido da el error de responsable', () => {
  assert.deepEqual(validarTarea({ nombre: 'Revisar pileta', responsableId: '' }), [RESPONSABLE_FALTA])
})

test('validarTarea: sin nombre y sin responsable da los dos errores, nombre primero', () => {
  assert.deepEqual(validarTarea({ nombre: '', responsableId: '' }), [NOMBRE_FALTA, RESPONSABLE_FALTA])
})

// ---------- agregarTarea ----------

const tarea = (overrides = {}) => ({
  id: 't',
  name: 'Tarea',
  completed: false,
  assignedTo: { id: 'u1', name: 'Ana' },
  ...overrides,
})

const alquiler = (tasks) => {
  const completed = tasks.filter((t) => t.completed).length
  return {
    id: 'r1',
    renterName: 'Familia Álvarez',
    startDate: '2026-09-04',
    endDate: '2026-09-06',
    finished: false,
    coowners: [{ id: 'u1', name: 'Ana' }],
    tasks,
    summary: { total: tasks.length, completed, pending: tasks.length - completed },
  }
}

test('agregarTarea: suma la tarea al final, sin tildar, y recalcula el resumen', () => {
  const antes = alquiler([tarea({ id: 'a', completed: true }), tarea({ id: 'b' }), tarea({ id: 'c' }), tarea({ id: 'd' })])
  const nueva = tarea({ id: 'nueva', name: 'Sacar la basura', assignedTo: { id: 'u3', name: 'Carla' } })

  const despues = agregarTarea(antes, nueva)

  assert.deepEqual(despues.tasks.map((t) => t.id), ['a', 'b', 'c', 'd', 'nueva'])
  assert.equal(despues.tasks.at(-1).completed, false)
  assert.equal(resumenLabel(antes.summary), '3 pendientes de 4')
  assert.equal(resumenLabel(despues.summary), '4 pendientes de 5')
})

test('agregarTarea: un alquiler "Sin tareas asignadas" pasa a "1 pendiente de 1"', () => {
  const despues = agregarTarea(alquiler([]), tarea({ id: 'nueva' }))

  assert.equal(resumenLabel(despues.summary), '1 pendiente de 1')
  assert.equal(resumenEstado(despues.summary), 'pendientes')
})

test('agregarTarea: un alquiler en "Todo listo (2/2)" pasa a "1 pendiente de 3"', () => {
  const antes = alquiler([tarea({ id: 'a', completed: true }), tarea({ id: 'b', completed: true })])
  assert.equal(resumenLabel(antes.summary), 'Todo listo (2/2)')

  const despues = agregarTarea(antes, tarea({ id: 'nueva' }))

  assert.equal(resumenLabel(despues.summary), '1 pendiente de 3')
})

test('agregarTarea: no muta el alquiler original y conserva el resto de sus campos', () => {
  const antes = alquiler([tarea({ id: 'a' })])

  const despues = agregarTarea(antes, tarea({ id: 'nueva' }))

  assert.equal(antes.tasks.length, 1)
  assert.deepEqual(antes.summary, { total: 1, completed: 0, pending: 1 })
  assert.notEqual(despues, antes)
  assert.equal(despues.renterName, 'Familia Álvarez')
  assert.deepEqual(despues.coowners, antes.coowners)
  assert.equal(despues.finished, false)
})

// ---------- mensajesDeRespuesta ----------

test('mensajesDeRespuesta: usa la lista errors cuando el server la manda', () => {
  const body = { error: 'a. b', errors: ['a', 'b'] }

  assert.deepEqual(mensajesDeRespuesta(body), ['a', 'b'])
})

test('mensajesDeRespuesta: si solo viene error, lo devuelve como único mensaje', () => {
  assert.deepEqual(mensajesDeRespuesta({ error: 'El alquiler ya terminó' }), ['El alquiler ya terminó'])
})

test('mensajesDeRespuesta: si la respuesta no tiene forma conocida, da un mensaje genérico', () => {
  for (const body of [null, undefined, {}, 'texto', { errors: [] }, { error: '' }]) {
    const mensajes = mensajesDeRespuesta(body)
    assert.equal(mensajes.length, 1)
    assert.ok(mensajes[0].length > 0)
  }
})
