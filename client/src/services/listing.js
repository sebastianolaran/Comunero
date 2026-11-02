import { API_URL } from '../lib/api'

const SIN_CONEXION = 'No se pudo conectar. Probar de nuevo en un momento.'

// fetch con los errores ya escritos para mostrar. El error lleva .field si el
// server marca un campo.
async function pedir(ruta, { method = 'GET', body, signal, fallo }) {
  let res
  try {
    res = await fetch(`${API_URL}${ruta}`, {
      method,
      signal,
      ...(body !== undefined && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw new Error(SIN_CONEXION)
  }
  const datos = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(datos.error ?? fallo), { field: datos.field, status: res.status })
  return datos
}

const rutaFicha = (assetId) => `/api/assets/${encodeURIComponent(assetId)}/listing`

export async function fetchListing(assetId, userId, { signal } = {}) {
  const params = new URLSearchParams({ userId })
  const datos = await pedir(`${rutaFicha(assetId)}?${params}`, { signal, fallo: 'No se pudo traer la ficha.' })
  return datos.listing
}

export async function saveListing(assetId, userId, ficha) {
  const datos = await pedir(rutaFicha(assetId), {
    method: 'PUT',
    body: { userId, ...ficha },
    fallo: 'No se pudo guardar la ficha.',
  })
  return datos.listing
}

export async function uploadListingPhoto(assetId, userId, foto) {
  const datos = await pedir(`${rutaFicha(assetId)}/photos`, {
    method: 'POST',
    body: { userId, ...foto },
    fallo: 'No se pudo subir la foto.',
  })
  return datos.listing
}

export async function deleteListingPhoto(assetId, userId, photoId) {
  const datos = await pedir(`${rutaFicha(assetId)}/photos/${encodeURIComponent(photoId)}`, {
    method: 'DELETE',
    body: { userId },
    fallo: 'No se pudo sacar la foto.',
  })
  return datos.listing
}

const rutaPublica = (slug) => `/api/public/listings/${encodeURIComponent(slug)}`

export function photoUrl(slug, photoId) {
  return `${API_URL}${rutaPublica(slug)}/photos/${encodeURIComponent(photoId)}`
}

export async function fetchPublicListing(slug, { signal } = {}) {
  const datos = await pedir(rutaPublica(slug), { signal, fallo: 'No se pudo cargar la ficha.' })
  return datos.listing
}

export async function sendPublicRequest(slug, pedido) {
  await pedir(`${rutaPublica(slug)}/requests`, {
    method: 'POST',
    body: pedido,
    fallo: 'No se pudo enviar la solicitud.',
  })
}
