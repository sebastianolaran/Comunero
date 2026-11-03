import { daysLabel, formatRange } from './rentalRequests.js'

const fecha = (valor) => String(valor).slice(0, 10)

export function textoTurno(turno) {
  const desde = fecha(turno.startDate)
  const hasta = fecha(turno.endDate)
  return `${formatRange(desde, hasta)} · ${daysLabel(desde, hasta)}`
}

// Mismas condiciones que valida el server: el botón solo aparece donde el pedido puede prosperar.
export function puedeProponerIntercambio(reserva, userId, hoy) {
  return Boolean(reserva)
    && reserva.type === 'USE'
    && reserva.status === 'ACTIVE'
    && reserva.userId !== userId
    && fecha(reserva.startDate) > hoy
}

export function agruparIntercambios(swaps, userId) {
  const grupos = { recibidos: [], propuestos: [], otros: [], resueltos: [] }
  for (const swap of swaps) {
    if (swap.status !== 'PENDING') grupos.resueltos.push(swap)
    else if (swap.recipient.id === userId) grupos.recibidos.push(swap)
    else if (swap.proposedBy.id === userId) grupos.propuestos.push(swap)
    else grupos.otros.push(swap)
  }
  return grupos
}

const ESTADOS = { PENDING: 'Pendiente', ACCEPTED: 'Aceptado', REJECTED: 'Rechazado', CANCELLED: 'Retirado' }

export function textoEstado(swap) {
  return swap.status === 'CANCELLED' && swap.closedReason ? 'Sin efecto' : ESTADOS[swap.status]
}
