import { fmtMoney } from './movements.js'

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

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

const personas = plural('persona', 'personas')
const lista = (items) => items.join(', ')

// Cambios de la ficha pública. Los textos largos solo dicen que cambiaron.
const CAMPOS_FICHA = {
  'listing.capacity': { label: 'capacidad', formato: personas },
  'listing.services': { label: 'servicios', formato: lista },
  'listing.approxLocation': { label: 'ubicación', formato: (v) => v },
}
const TEXTOS_FICHA = {
  'listing.description': 'se cambió la descripción',
  'listing.conditions': 'se cambiaron las condiciones',
}
const vacioFicha = (valor) => valor == null || (Array.isArray(valor) && valor.length === 0)

function textoCambioFicha({ field, from, to }) {
  if (field === 'listing.published') return `Ficha pública: se ${to ? 'volvió a publicar' : 'pausó'}`
  if (field === 'listing.photos.order') return 'Ficha pública: se cambió el orden de las fotos'
  if (field === 'listing.link') return 'Ficha pública: se generó un link nuevo (el anterior dejó de andar)'
  if (field === 'listing.photos') {
    return `Ficha pública: se ${to > from ? 'subió' : 'sacó'} una foto`
  }
  if (TEXTOS_FICHA[field]) return `Ficha pública: ${TEXTOS_FICHA[field]}`
  const { label, formato } = CAMPOS_FICHA[field]
  const mostrar = (valor) => (vacioFicha(valor) ? 'sin dato' : formato(valor))
  return `Ficha pública, ${label}: de ${mostrar(from)} a ${mostrar(to)}`
}

export function textoCambio({ field, from, to, reason }, nombres) {
  if (field.startsWith('listing.')) return textoCambioFicha({ field, from, to })
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

const PARTES_ARGENTINA = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Argentina/Buenos_Aires',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

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
export function textoFechaCambio(iso) {
  const partes = Object.fromEntries(PARTES_ARGENTINA.formatToParts(new Date(iso)).map((p) => [p.type, p.value]))
  return `${partes.day} ${MESES[partes.month - 1]} ${partes.year}, ${partes.hour}:${partes.minute}`
}
