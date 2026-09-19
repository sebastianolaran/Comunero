import { API_URL } from '../lib/api'
import { mensajesDeRespuesta } from '../lib/rentalPreparations'

export async function fetchRentalPreparations(assetId, { signal } = {}) {
  const params = new URLSearchParams({ assetId })
  const res = await fetch(`${API_URL}/api/rental-preparations?${params}`, { signal })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const alquileres = await res.json()
  // Un 200 con otra forma (ej. una página de error de un proxy) rompería el render.
  if (!Array.isArray(alquileres)) throw new Error('Respuesta inesperada')
  return alquileres
}

// Error del alta con los mensajes ya listos para mostrar en el formulario.
export class AltaTareaError extends Error {
  constructor(mensajes) {
    super(mensajes.join('. '))
    this.mensajes = mensajes
  }
}

// POST /api/rental-preparations/tasks. Devuelve la tarea creada
// ({ id, name, completed, assignedTo }); si algo falla lanza AltaTareaError.
export async function createRentalTask({ reservationId, name, assignedToId }, { signal } = {}) {
  let res
  try {
    res = await fetch(`${API_URL}/api/rental-preparations/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reservationId, name, assignedToId }),
      signal,
    })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw new AltaTareaError(['No se pudo conectar con el servidor. Probá de nuevo.'])
  }

  // Un cuerpo que no es JSON (ej. una página de error de un proxy) no rompe: cae al mensaje genérico.
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new AltaTareaError(mensajesDeRespuesta(body))
  if (typeof body?.id !== 'string') throw new AltaTareaError(mensajesDeRespuesta(null))
  return body
}
