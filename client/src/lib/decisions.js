import { formatMoney } from './rentalRequests.js'

export const ESTADOS = { APPROVED: 'Aprobada', REJECTED: 'Rechazada' }

export const FILTROS = [
  { id: 'todas', label: 'Todas', status: null },
  { id: 'aprobadas', label: 'Aprobadas', status: 'APPROVED' },
  { id: 'rechazadas', label: 'Rechazadas', status: 'REJECTED' },
]

export function filtrar(decisiones, filtroId) {
  const status = FILTROS.find((f) => f.id === filtroId)?.status
  return status ? decisiones.filter((d) => d.status === status) : decisiones
}

export function textoMonto(estimado) {
  if (!estimado) return null
  const monto = formatMoney(estimado.amount)
  return estimado.type === 'INCOME' ? `Ingreso estimado: + ${monto}` : `Gasto estimado: - ${monto}`
}

// Sin votesNeeded (propuestas cerradas antes de guardarlo) no hay denominador.
export function textoVotos({ yesVotes, votesNeeded }) {
  if (votesNeeded == null) return `${yesVotes} ${yesVotes === 1 ? 'voto' : 'votos'} a favor`
  return `${yesVotes}/${votesNeeded} votos a favor`
}
