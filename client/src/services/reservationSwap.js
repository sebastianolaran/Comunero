import { API_URL } from '../lib/api'
import { pedir, mensajeHttp } from '../lib/http'

async function enviar(url, cuerpo, mensaje) {
  const res = await pedir(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? mensaje)
  return body.swap
}

export async function fetchSwaps(assetId, userId, { signal } = {}) {
  const params = new URLSearchParams({ assetId, userId })
  const res = await pedir(`${API_URL}/api/reservation-swaps?${params}`, { signal })
  if (!res.ok) throw new Error(mensajeHttp(res.status))
  return (await res.json()).swaps
}

// Turnos propios que se pueden ofrecer a cambio de requestedReservationId.
export async function fetchSwapOptions(userId, requestedReservationId, { signal } = {}) {
  const params = new URLSearchParams({ userId, requestedReservationId })
  const res = await pedir(`${API_URL}/api/reservation-swaps/options?${params}`, { signal })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? mensajeHttp(res.status))
  return body.reservations
}

export function proposeSwap({ userId, offeredReservationId, requestedReservationId }) {
  return enviar(`${API_URL}/api/reservation-swaps`, { userId, offeredReservationId, requestedReservationId }, 'No se pudo proponer el intercambio.')
}

export function respondSwap(swapId, { userId, value }) {
  return enviar(`${API_URL}/api/reservation-swaps/${encodeURIComponent(swapId)}/response`, { userId, value }, 'No se pudo responder el intercambio.')
}

export function cancelSwap(swapId, { userId }) {
  return enviar(`${API_URL}/api/reservation-swaps/${encodeURIComponent(swapId)}/cancellation`, { userId }, 'No se pudo retirar el intercambio.')
}
