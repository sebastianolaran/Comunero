// Formato de fechas del listado de solicitudes, igual que el prototipo
// (Compartido.dc.html).

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MS_POR_DIA = 24 * 60 * 60 * 1000

// "2026-09-11" -> ms UTC. Se parsea a mano para que la zona horaria local
// no corra el día.
function utc(fecha) {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  return Date.UTC(anio, mes - 1, dia)
}

function corto(fecha) {
  const [, mes, dia] = fecha.split('-').map(Number)
  return `${dia} ${MESES[mes - 1]}`
}

// "11 sep – 14 sep 2026", o "20 ago 2026" si es un solo día. Si el rango
// cruza de año lleva los dos: "20 dic 2026 – 3 ene 2027".
export function formatRange(from, to = from) {
  const anioDesde = from.slice(0, 4)
  const anioHasta = to.slice(0, 4)
  if (from === to) return `${corto(from)} ${anioHasta}`
  if (anioDesde !== anioHasta) return `${corto(from)} ${anioDesde} – ${corto(to)} ${anioHasta}`
  return `${corto(from)} – ${corto(to)} ${anioHasta}`
}

// Cantidad de días del alquiler, contando el primero y el último.
export function daysLabel(from, to) {
  const dias = Math.max(1, (utc(to) - utc(from)) / MS_POR_DIA + 1)
  return dias === 1 ? '1 día' : `${dias} días`
}
