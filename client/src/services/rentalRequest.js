import { API_URL } from '../lib/api'

// Solicitudes de alquiler del bien, cada una con yesCount, coownerCount y
// status (PENDING | APPROVED | REJECTED) ya calculados por el server.
export async function fetchRentalRequests(assetId, { signal } = {}) {
  const params = new URLSearchParams({ assetId })
  const res = await fetch(`${API_URL}/api/rental-requests?${params}`, { signal })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}
