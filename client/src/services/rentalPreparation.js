import { API_URL } from '../lib/api'

export async function fetchRentalPreparations(assetId, { signal } = {}) {
  const params = new URLSearchParams({ assetId })
  const res = await fetch(`${API_URL}/api/rental-preparations?${params}`, { signal })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const alquileres = await res.json()
  // Un 200 con otra forma (ej. una página de error de un proxy) rompería el render.
  if (!Array.isArray(alquileres)) throw new Error('Respuesta inesperada')
  return alquileres
}
