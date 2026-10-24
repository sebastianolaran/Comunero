import { fmtFechaHora, fmtMoney } from './format.js'

const plural = (singular, varios) => (n) => `${n} ${n === 1 ? singular : varios}`

// Cómo se nombra y se muestra cada valor en "Cambios recientes".
const CAMPOS = {
  rentalDailyRate: { label: 'Precio por día del alquiler', formato: fmtMoney, vacio: 'sin precio' },
  maxConsecutiveDays: { label: 'Máximo de días consecutivos', formato: plural('día', 'días'), vacio: 'sin límite' },
  responseHours: { label: 'Tiempo para responder', formato: plural('hora', 'horas'), vacio: 'sin límite' },
  noResponseAction: {
    label: 'Si alguien no responde a tiempo',
    formato: (accion) => (accion === 'APPROVE' ? 'se aprueba' : 'se rechaza'),
  },
}

// Un campo numérico del form: vacío es "sin límite" (null). Acepta "70.000".
export function leerNumero(texto) {
  const limpio = texto.replace(/[\s$.]/g, '')
  if (limpio === '') return { valor: null }
  if (!/^\d+$/.test(limpio) || Number(limpio) === 0) return { error: 'Tiene que ser un número entero mayor a cero.' }
  return { valor: Number(limpio) }
}

export function sumaPorcentajes(borrador) {
  return Object.values(borrador).reduce((suma, texto) => suma + (Number(texto) || 0), 0)
}

// "25" o "33,3": lo que le toca a cada uno en partes iguales.
export function porcentajeIgual(cantidad) {
  return String(Math.round(1000 / cantidad) / 10).replace('.', ',')
}

// En el orden de los integrantes: la base (jsonb) no conserva el de las claves.
function textoPorcentajes(porcentajes, nombres) {
  if (porcentajes == null) return 'partes iguales'
  const orden = Object.keys(nombres)
  return Object.entries(porcentajes)
    .sort(([a], [b]) => orden.indexOf(a) - orden.indexOf(b))
    .map(([id, pct]) => `${nombres[id] ?? 'Alguien'} ${pct}%`)
    .join(', ')
}

export function textoCambio({ field, from, to, reason }, nombres) {
  if (field === 'percents' && reason === 'MEMBER_JOINED') {
    return `Se sumó un integrante: los porcentajes volvieron a partes iguales (eran ${textoPorcentajes(from, nombres)})`
  }
  if (field === 'percents' && reason === 'MEMBER_LEFT') {
    // Si el que se fue tenía 0%, los demás siguen sumando 100 y se mantienen.
    const ahora = to == null ? 'volvieron a partes iguales' : `quedaron ${textoPorcentajes(to, nombres)}`
    return `Se fue un integrante: los porcentajes ${ahora} (eran ${textoPorcentajes(from, nombres)})`
  }
  if (field === 'percents') {
    return `Porcentajes: de ${textoPorcentajes(from, nombres)} a ${textoPorcentajes(to, nombres)}`
  }
  const { label, formato, vacio } = CAMPOS[field]
  const mostrar = (valor) => (valor == null ? vacio : formato(valor))
  return `${label}: de ${mostrar(from)} a ${mostrar(to)}`
}

// userId -> nombre de los integrantes, y al final los que ya no están pero
// aparecen en el registro (quien se fue firma su salida, o figura en porcentajes
// viejos), para nombrarlos.
export function nombresDelRegistro(members, changes, formerNames = {}) {
  const nombres = Object.fromEntries(members.map((m) => [m.id, m.name]))
  for (const { user } of changes) nombres[user.id] ??= user.name
  for (const [id, name] of Object.entries(formerNames)) nombres[id] ??= name
  return nombres
}

// "21 oct 2026, 14:05", en hora de Buenos Aires como el resto de la app.
export const textoFechaCambio = fmtFechaHora

// Aviso de la confirmación de salir: qué deudas siguen abiertas con cada uno.
// coowners: los del balance ({ user, balance }); negativo es lo que debés.
export function textoSaldosAlSalir(coowners) {
  const lista = (items) => new Intl.ListFormat('es', { type: 'conjunction' }).format(items)
  const debes = coowners.filter((c) => c.balance < 0)
  const teDeben = coowners.filter((c) => c.balance > 0)
  const partes = []
  if (debes.length) partes.push(`Deudas pendientes: ${lista(debes.map((c) => `${fmtMoney(-c.balance)} a ${c.user.name}`))}.`)
  if (teDeben.length) partes.push(`Saldos a favor: ${lista(teDeben.map((c) => `${c.user.name} ${fmtMoney(c.balance)}`))}.`)
  if (!partes.length) return null
  return `${partes.join(' ')} Salir del bien no las salda: conviene resolverlas antes en Balance.`
}
