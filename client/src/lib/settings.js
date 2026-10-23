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

export function textoCambio({ field, from, to, reason }, nombres) {
  if (field === 'percents' && reason === 'MEMBER_JOINED') {
    return `Se sumó un integrante: los porcentajes volvieron a partes iguales (eran ${textoPorcentajes(from, nombres)})`
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

// "21 oct 2026, 14:05", en hora de Buenos Aires como el resto de la app.
export function textoFechaCambio(iso) {
  const partes = Object.fromEntries(PARTES_ARGENTINA.formatToParts(new Date(iso)).map((p) => [p.type, p.value]))
  return `${partes.day} ${MESES[partes.month - 1]} ${partes.year}, ${partes.hour}:${partes.minute}`
}
