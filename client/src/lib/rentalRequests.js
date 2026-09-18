const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MS_POR_DIA = 24 * 60 * 60 * 1000

// No ordena: el server ya las manda de la más reciente a la más antigua.
export function agrupar(solicitudes) {
  const pendientes = []
  const resueltas = []
  for (const s of solicitudes) {
    ;(s.status === 'PENDING' ? pendientes : resueltas).push(s)
  }
  return { pendientes, resueltas }
}

export function votosLabel({ yesCount, coownerCount }) {
  return `${yesCount} de ${coownerCount}`
}

// Las fechas se parsean a mano para que la zona horaria local no corra el día.
function corto(fecha) {
  const [, mes, dia] = fecha.split('-').map(Number)
  return `${dia} ${MESES[mes - 1]}`
}

export function formatRange(desde, hasta = desde) {
  const anioDesde = desde.slice(0, 4)
  const anioHasta = hasta.slice(0, 4)
  if (desde === hasta) return `${corto(desde)} ${anioHasta}`
  if (anioDesde !== anioHasta) return `${corto(desde)} ${anioDesde} – ${corto(hasta)} ${anioHasta}`
  return `${corto(desde)} – ${corto(hasta)} ${anioHasta}`
}

function utc(fecha) {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  return Date.UTC(anio, mes - 1, dia)
}

export function daysLabel(desde, hasta = desde) {
  const dias = Math.max(1, (utc(hasta) - utc(desde)) / MS_POR_DIA + 1)
  return dias === 1 ? '1 día' : `${dias} días`
}
