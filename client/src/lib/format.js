// Formatos de plata y fechas de toda la app. Las fechas 'AAAA-MM-DD' se parsean
// a mano para que la zona horaria del dispositivo no corra el día; los
// instantes (createdAt) se muestran en hora de Buenos Aires, como el resto.

export const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const ZONA = 'America/Argentina/Buenos_Aires'

// Pesos enteros con punto de miles: 48000 -> "$48.000".
export function fmtMoney(amount) {
  const digits = String(Math.abs(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${amount < 0 ? '-' : ''}$${digits}`
}

export function fmtSigned(amount) {
  if (amount > 0) return `+ ${fmtMoney(amount)}`
  if (amount < 0) return `- ${fmtMoney(-amount)}`
  return fmtMoney(0)
}

function partes(fecha) {
  const [anio, mes, dia] = fecha.slice(0, 10).split('-').map(Number)
  return { anio, mes, dia }
}

const corto = ({ dia, mes }) => `${dia} ${MESES_CORTOS[mes - 1]}`

// Mismo texto de votación en Alquiler, Calendario y Decisiones.
export function fmtAprobaron(si, total) {
  if (total == null) return `${si} a favor`
  return `${si} de ${total} aprobaron`
}

// "24 oct": dentro de un mes o de una lista del mismo año.
export function fmtDiaCorto(fecha) {
  return corto(partes(fecha))
}

// "24 oct 2026".
export function fmtDia(fecha) {
  const p = partes(fecha)
  return `${corto(p)} ${p.anio}`
}

// Un día "20 ago 2026", un rango "4 sep – 6 sep 2026" (el año una sola vez
// salvo que cruce de año).
export function fmtRango(desde, hasta = desde) {
  const a = partes(desde)
  const b = partes(hasta)
  if (desde.slice(0, 10) === hasta.slice(0, 10)) return fmtDia(desde)
  if (a.anio !== b.anio) return `${fmtDia(desde)} – ${fmtDia(hasta)}`
  return `${corto(a)} – ${corto(b)} ${b.anio}`
}

const PARTES_ARGENTINA = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONA,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function partesInstante(iso) {
  return Object.fromEntries(PARTES_ARGENTINA.formatToParts(new Date(iso)).map((p) => [p.type, p.value]))
}

// Un instante como el día que ve el grupo: "25 sep 2026".
export function fmtDiaDeInstante(iso) {
  const p = partesInstante(iso)
  return `${Number(p.day)} ${MESES_CORTOS[p.month - 1]} ${p.year}`
}

// "21 oct 2026, 14:05".
export function fmtFechaHora(iso) {
  const p = partesInstante(iso)
  return `${fmtDiaDeInstante(iso)}, ${p.hour}:${p.minute}`
}

// Los ingresos de alquiler cargados antes guardaban "del 2026-11-21 al
// 2026-11-23" en la descripción; se muestran con el formato de la app.
const RANGO_ISO = / del (\d{4}-\d{2}-\d{2}) al (\d{4}-\d{2}-\d{2})$/

export function descripcionLegible(descripcion) {
  return descripcion.replace(RANGO_ISO, (_, desde, hasta) => ` · ${fmtRango(desde, hasta)}`)
}
