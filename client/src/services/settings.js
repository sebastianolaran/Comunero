import { API_URL } from '../lib/api'

const SIN_CONEXION = 'No pudimos conectarnos. Probá de nuevo en un momento.'

export async function fetchSettings(assetId, userId, { signal } = {}) {
  const params = new URLSearchParams({ userId })
  let res
  try {
    res = await fetch(`${API_URL}/api/assets/${encodeURIComponent(assetId)}/settings?${params}`, { signal })
  } catch (err) {
    // La cancelación al desmontar tiene que seguir siendo AbortError.
    if (err.name === 'AbortError') throw err
    throw new Error(SIN_CONEXION)
  }
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error ?? 'No pudimos traer la configuración.')
  return body.settings
}

// Solo manda lo que cambia. El error lleva .field cuando el server marca un campo.
export async function updateSettings(assetId, userId, cambios) {
  let res
  try {
    res = await fetch(`${API_URL}/api/assets/${encodeURIComponent(assetId)}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...cambios }),
    })
  } catch {
    throw new Error(SIN_CONEXION)
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw Object.assign(new Error(body.error ?? 'No se pudo guardar la configuración.'), { field: body.field })
  }
  return body.settings
}

// Irse del bien. Sin votación; el server lo frena si hay votaciones abiertas o
// si es el último integrante.
export async function leaveAsset(assetId, userId) {
  let res
  try {
    res = await fetch(`${API_URL}/api/assets/${encodeURIComponent(assetId)}/leave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
  } catch {
    throw new Error(SIN_CONEXION)
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? 'No pudimos sacarte del bien.')
  }
}
