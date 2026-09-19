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

const SIN_CONEXION = 'No se pudo conectar con el servidor. Probá de nuevo.'

// Error del alta con los mensajes ya listos para mostrar en el formulario.
export class AltaTareaError extends Error {
  constructor(mensajes) {
    super(mensajes.join('. '))
    this.mensajes = mensajes
  }
}

// Error de tildar, reasignar o eliminar, con los mensajes ya listos para mostrar
// en la tarjeta. `status` es el HTTP de la respuesta (undefined si no hubo conexión).
export class CambioTareaError extends Error {
  constructor(mensajes, status) {
    super(mensajes.join('. '))
    this.mensajes = mensajes
    this.status = status
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
    throw new AltaTareaError([SIN_CONEXION])
  }

  // Un cuerpo que no es JSON (ej. una página de error de un proxy) no rompe: cae al mensaje genérico.
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new AltaTareaError(mensajesDeRespuesta(body))
  if (typeof body?.id !== 'string') throw new AltaTareaError(mensajesDeRespuesta(null))
  return body
}

const ERROR_MODIFICAR = 'No se pudo modificar la tarea. Probá de nuevo.'
const ERROR_ELIMINAR = 'No se pudo eliminar la tarea. Probá de nuevo.'

// PATCH/DELETE sobre una tarea. Si no hay conexión lanza CambioTareaError.
async function pedirCambio(id, { method, body }, { signal }) {
  try {
    return await fetch(`${API_URL}/api/rental-preparations/tasks/${encodeURIComponent(id)}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw new CambioTareaError([SIN_CONEXION])
  }
}

// PATCH /api/rental-preparations/tasks/:id. `cambios` es { completed } y/o
// { assignedToId }. Devuelve la tarea ya modificada ({ id, name, completed,
// assignedTo }); si algo falla lanza CambioTareaError.
export async function updateRentalTask(id, cambios, { signal } = {}) {
  const res = await pedirCambio(id, { method: 'PATCH', body: cambios }, { signal })

  const body = await res.json().catch(() => null)
  if (!res.ok) throw new CambioTareaError(mensajesDeRespuesta(body, ERROR_MODIFICAR), res.status)
  if (typeof body?.id !== 'string') throw new CambioTareaError([ERROR_MODIFICAR], res.status)
  return body
}

// DELETE /api/rental-preparations/tasks/:id. Responde 204 sin cuerpo; si algo
// falla lanza CambioTareaError. Un 404 no es un fallo: otro copropietario ya la
// borró y la tarea quedó como se quería.
export async function deleteRentalTask(id, { signal } = {}) {
  const res = await pedirCambio(id, { method: 'DELETE' }, { signal })
  if (res.ok || res.status === 404) return

  const body = await res.json().catch(() => null)
  throw new CambioTareaError(mensajesDeRespuesta(body, ERROR_ELIMINAR), res.status)
}
