import { API_URL } from '../lib/api'

export async function fetchRentalRequests(assetId, { userId, signal } = {}) {
  const params = new URLSearchParams({ assetId })
  if (userId) params.set('userId', userId)
  const res = await fetch(`${API_URL}/api/rental-requests?${params}`, { signal })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// Tira un Error con el mensaje del server (ej. 409 si ya se resolvió).
export async function voteRentalRequest(id, voto) {
  const res = await fetch(`${API_URL}/api/rental-requests/${encodeURIComponent(id)}/votes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(voto),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? 'No se pudo registrar el voto.')
  return body
}

// Tira un Error con el mensaje del server (ej. 409 si ya estaba pago).
export async function markRentalPaid(id, { userId }) {
  const res = await fetch(`${API_URL}/api/rental-requests/${encodeURIComponent(id)}/payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? 'No se pudo marcar el pago.')
  return body
}

// Tira un Error con el mensaje del server y, si es de un campo, su nombre en .field.
export async function createRentalRequest(solicitud) {
  const res = await fetch(`${API_URL}/api/rental-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(solicitud),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw Object.assign(new Error(body.error ?? 'No se pudo crear la solicitud.'), { field: body.field })
  }
  return body
}
