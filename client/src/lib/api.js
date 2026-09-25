// URL base del backend. En build, Vite reemplaza import.meta.env.VITE_API_URL
// por el valor del entorno; si no esta seteada, cae al server local.
// El `?.` es para que los tests puedan importar este módulo con node --test,
// donde import.meta.env no existe. Vite igual define el objeto entero.
export const API_URL = import.meta.env?.VITE_API_URL ?? 'http://localhost:3000'

// Reservas que se solapan con un mes (YYYY-MM), para la HU "Consultar
// calendario". `signal` es opcional, para poder cancelar el fetch al
// desmontar el componente o al cambiar de mes.
export async function fetchReservations(assetId, month, { signal } = {}) {
  const params = new URLSearchParams({ assetId, month })
  const res = await fetch(`${API_URL}/api/reservations?${params}`, { signal })

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }

  const body = await res.json()
  return body.reservations
}

// Entrar con mail y contraseña. Si no coinciden, el server responde 401 con
// un { error } que ya viene escrito para mostrarle a quien está entrando.
export async function login({ email, password }) {
  let res
  try {
    res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
  } catch {
    // fetch rechaza con "Failed to fetch" cuando no hay red o el server no
    // está: ese texto no es para mostrarle a nadie.
    throw new Error('No pudimos conectarnos. Probá de nuevo en un momento.')
  }

  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    // El 400 y el 401 traen un { error } ya escrito para la pantalla. Un 500
    // no trae nada útil, así que se reemplaza por algo legible.
    throw new Error(body.error ?? 'No pudimos entrar. Probá de nuevo en un momento.')
  }

  return body.user
}

// Historia "Solicitar turno de uso propio". startDate/endDate: 'YYYY-MM-DD'.
// Si el server rechaza la solicitud (400/409), tira un Error con el mensaje
// que mandó el backend (fechas invertidas, dias ocupados, etc.).
export async function createReservation({ assetId, userId, startDate, endDate, note }) {
  const res = await fetch(`${API_URL}/api/reservations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assetId, userId, startDate, endDate, note }),
  })

  const body = await res.json()
  if (!res.ok) {
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }

  return body.reservation
}
