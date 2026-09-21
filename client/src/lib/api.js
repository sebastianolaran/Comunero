// URL base del backend. En build, Vite reemplaza import.meta.env.VITE_API_URL
// por el valor del entorno; si no esta seteada, cae al server local.
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

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

// Historia "Solicitar alquiler a terceros". montoModo: 'TOTAL' | 'POR_DIA'.
export async function createRental({
  assetId,
  userId,
  startDate,
  endDate,
  renterName,
  renterPhone,
  montoModo,
  monto,
  note,
}) {
  const res = await fetch(`${API_URL}/api/reservations/rental`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      assetId,
      userId,
      startDate,
      endDate,
      renterName,
      renterPhone,
      montoModo,
      monto,
      note,
    }),
  })

  const body = await res.json()
  if (!res.ok) {
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }

  return body
}
