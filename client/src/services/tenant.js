import { API_URL } from '../lib/api'

export async function fetchTenants(assetId, { q = '', signal } = {}) {
  const params = new URLSearchParams({ assetId })
  if (q.trim()) params.set('q', q.trim())
  const res = await fetch(`${API_URL}/api/tenants?${params}`, { signal })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}
