const fecha = (valor) => String(valor).slice(0, 10)

export const ALCANCES = [
  { id: 'todas', label: 'De todos' },
  { id: 'mias', label: 'Mías' },
]

export const ESTADOS = [
  { id: 'todas', label: 'Todas' },
  { id: 'PENDING', label: 'Pendientes' },
  { id: 'ACTIVE', label: 'Aprobadas' },
  { id: 'REJECTED', label: 'Rechazadas' },
]

const TEXTO_ESTADO = { PENDING: 'Pendiente', ACTIVE: 'Aprobada', REJECTED: 'Rechazada' }

export function filtrarReservas(reservas, { alcance, estado }, userId) {
  return reservas
    .filter((r) => alcance === 'todas' || r.userId === userId)
    .filter((r) => estado === 'todas' || r.status === estado)
}

export function puedeCancelar(reserva, userId, hoy) {
  return reserva.userId === userId && reserva.status !== 'REJECTED' && fecha(reserva.startDate) > hoy
}

// Pedirla ya cuenta como el Sí de quien la pidió: las propias no se votan.
export function porVotar(reservas, userId, hoy) {
  return reservas
    .filter((r) => r.status === 'PENDING' && r.userId !== userId && !r.approvedBy?.includes(userId) && fecha(r.startDate) >= hoy)
    .sort((a, b) => fecha(a.startDate).localeCompare(fecha(b.startDate)))
}

export function textoEstado(reserva) {
  return TEXTO_ESTADO[reserva.status]
}

export function textoMotivo(reserva) {
  if (reserva.rejections?.length) return reserva.rejections.map((r) => `${r.name}: ${r.reason}`).join(' · ')
  return reserva.rejectionReason ?? null
}
