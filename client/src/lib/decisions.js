import { fmtAprobaron, fmtDiaDeInstante } from './format.js'
import { formatMoney } from './rentalRequests.js'

export const ESTADOS = { OPEN: 'En votación', APPROVED: 'Aprobada', REJECTED: 'Rechazada' }

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
  return fmtAprobaron(yesVotes, votesNeeded)
}

const MONTO = /^-?\d+$/
const MONTO_MAXIMO = 2_147_483_647

// Acepta "180.000" o "$180.000": los puntos son separadores de miles.
function parsearMontoEstimado(texto) {
  const limpio = texto.replace(/[\s$.]/g, '')
  if (limpio === '') return { monto: null }
  if (!MONTO.test(limpio)) return { error: 'El monto estimado tiene que ser un número entero' }
  const monto = Number(limpio)
  if (monto <= 0) return { error: 'El monto estimado tiene que ser mayor a cero' }
  if (monto > MONTO_MAXIMO) return { error: 'El monto estimado es demasiado grande' }
  return { monto }
}

// Devuelve { errores } con un mensaje por campo, o { decision } lista para el POST.
export function validarDecision({ titulo, monto }) {
  const title = titulo.trim()
  const montoEstimado = parsearMontoEstimado(monto)

  const errores = {}
  if (!title) errores.titulo = 'El título es obligatorio'
  if (montoEstimado.error) errores.monto = montoEstimado.error
  if (Object.keys(errores).length > 0) return { errores }

  return { decision: { title, estimatedAmount: montoEstimado.monto } }
}

// El server marca el campo con el nombre del body; el form usa los suyos.
export const CAMPO_DEL_SERVER = { title: 'titulo', estimatedAmount: 'monto' }

export function textoFecha(createdAt) {
  return `Propuesta el ${fmtDiaDeInstante(createdAt)}`
}

const VOTOS = { YES: 'Sí', NO: 'No' }

export const OPCIONES_VOTO = [
  { value: 'YES', label: VOTOS.YES },
  { value: 'NO', label: VOTOS.NO },
]

// Sí/No para quien no votó o tocó el lápiz; si no, "Tu voto".
export function mostrarBotones({ myVote }, editando) {
  return !myVote || editando
}

export function textoTuVoto(myVote) {
  return `Voto propio: ${VOTOS[myVote]}`
}
