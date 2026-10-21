import { API_URL } from '../lib/api'

export async function fetchAssets(userId, { signal } = {}) {
  const params = new URLSearchParams({ userId })
  const res = await fetch(`${API_URL}/api/assets?${params}`, { signal })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error ?? 'No pudimos traer tus bienes.')
  return body.assets
}

async function enviar(path, datos, errorPorDefecto) {
  let res
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    })
  } catch {
    throw new Error('No pudimos conectarnos. Probá de nuevo en un momento.')
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw Object.assign(new Error(body.error ?? errorPorDefecto), { field: body.field, status: res.status })
  }
  return body
}

export async function createAsset({ userId, name }) {
  const body = await enviar('/api/assets', { userId, name }, 'No se pudo crear el bien.')
  return body.asset
}

export function joinAsset({ userId, code }) {
  return enviar('/api/assets/join', { userId, code }, 'No pudimos sumarte al bien.')
}
