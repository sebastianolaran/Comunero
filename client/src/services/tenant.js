import { API_URL } from '../lib/api'

export async function fetchTenants(assetId, { q = '', signal } = {}) {
  const params = new URLSearchParams({ assetId })
  if (q.trim()) params.set('q', q.trim())
  const res = await fetch(`${API_URL}/api/tenants?${params}`, { signal })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function fetchTenant(id, { assetId, signal } = {}) {
  const params = new URLSearchParams({ assetId })
  const res = await fetch(`${API_URL}/api/tenants/${encodeURIComponent(id)}?${params}`, { signal })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function enviar(url, method, body, errorPorDefecto) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const respuesta = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(respuesta.error ?? errorPorDefecto)
  return respuesta
}

// Tiran un Error con el mensaje del server.
export function rateTenant(id, { userId, rating }) {
  const url = `${API_URL}/api/tenants/${encodeURIComponent(id)}`
  return enviar(url, 'PATCH', { userId, rating }, 'No se pudo guardar la clasificación.')
}

export function commentTenant(id, { userId, text }) {
  const url = `${API_URL}/api/tenants/${encodeURIComponent(id)}/comments`
  return enviar(url, 'POST', { userId, text }, 'No se pudo guardar la observación.')
}
