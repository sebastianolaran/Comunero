import { API_URL } from '../lib/api'

// Historial de propuestas cerradas, de la más reciente a la más vieja.
export async function fetchClosedDecisions(assetId, { signal } = {}) {
  const params = new URLSearchParams({ assetId })
  const res = await fetch(`${API_URL}/api/decisions?${params}`, { signal })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const body = await res.json()
  return body.decisions
}
