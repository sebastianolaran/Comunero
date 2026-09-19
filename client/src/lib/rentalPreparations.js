const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

// Las fechas se parsean a mano para que la zona horaria local no corra el día.
function corto(fecha) {
  const [, mes, dia] = fecha.split('-').map(Number)
  return `${dia} ${MESES[mes - 1]}`
}

// Mismo formato que Solicitudes: un día "20 ago 2026", un rango "4 sep – 6 sep 2026".
export function formatRange(desde, hasta = desde) {
  const anioDesde = desde.slice(0, 4)
  const anioHasta = hasta.slice(0, 4)
  if (desde === hasta) return `${corto(desde)} ${anioHasta}`
  if (anioDesde !== anioHasta) return `${corto(desde)} ${anioDesde} – ${corto(hasta)} ${anioHasta}`
  return `${corto(desde)} – ${corto(hasta)} ${anioHasta}`
}

// 'sin-tareas' | 'pendientes' | 'listo'. Se calcula siempre desde los conteos
// que manda el server; nadie lo marca a mano.
export function resumenEstado({ total, pending }) {
  if (total === 0) return 'sin-tareas'
  return pending > 0 ? 'pendientes' : 'listo'
}

export function resumenLabel(resumen) {
  const { total, completed, pending } = resumen

  switch (resumenEstado(resumen)) {
    case 'sin-tareas':
      return 'Sin tareas asignadas'
    case 'pendientes':
      return `${pending} ${pending === 1 ? 'pendiente' : 'pendientes'} de ${total}`
    default:
      return `Todo listo (${completed}/${total})`
  }
}
