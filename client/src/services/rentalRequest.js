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
