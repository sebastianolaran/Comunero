import { API_URL } from '../lib/api'

// Historial de propuestas cerradas, de la más reciente a la más vieja.
export async function fetchClosedDecisions(assetId, { signal } = {}) {
  const params = new URLSearchParams({ assetId })
  const res = await fetch(`${API_URL}/api/decisions?${params}`, { signal })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const body = await res.json()
  return body.decisions
}

// Propuestas en votación, de la más nueva a la más vieja.
export async function fetchOpenDecisions(assetId, { userId, signal } = {}) {
  const params = new URLSearchParams({ assetId, status: 'OPEN', ...(userId && { userId }) })
  const res = await fetch(`${API_URL}/api/decisions?${params}`, { signal })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const body = await res.json()
  return body.decisions
}

export async function createDecision(decision) {
  const res = await fetch(`${API_URL}/api/decisions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(decision),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw Object.assign(new Error(body.error ?? 'No se pudo crear la propuesta.'), { field: body.field })
  }
  return body
}

// El error lleva .status para distinguir el 409 de una propuesta ya cerrada.
export async function voteDecision(decisionId, { userId, value }) {
  const res = await fetch(`${API_URL}/api/decisions/${encodeURIComponent(decisionId)}/votes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, value }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw Object.assign(new Error(body.error ?? 'No se pudo registrar el voto.'), { status: res.status })
  }
  return body
}
