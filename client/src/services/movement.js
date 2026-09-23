import { API_URL } from '../lib/api'

// Movimientos del bien. Todos los pedidos llevan assetId y userId: el bien que
// se mira y quien lo mira (define "cuánto te toca").
// TODO: el userId sale de la sesión cuando exista el login.

// Devuelve el cuerpo (null en un 204) y, si la respuesta no es 2xx, tira un
// Error con el mensaje de { error } que mandó el server.
async function pedir(path, { method = 'GET', body, signal } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    signal,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (res.status === 204) return null
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
  return data
}

const query = (quien, extra = {}) => new URLSearchParams({ ...quien, ...extra })

export function fetchCoowners(quien, { signal } = {}) {
  return pedir(`/api/movements/coowners?${query(quien)}`, { signal })
}

// { current, periods }: los meses que tienen movimientos más el actual.
export function fetchPeriods(quien, { signal } = {}) {
  return pedir(`/api/movements/periods?${query(quien)}`, { signal })
}

// { period, summary, counts, movements }. type filtra la lista, pero no los
// contadores, que siempre son del período entero.
export function fetchMovements(quien, { period, type }, { signal } = {}) {
  return pedir(`/api/movements?${query(quien, { period, ...(type && { type }) })}`, { signal })
}

export function createMovement(quien, movimiento) {
  return pedir('/api/movements', { method: 'POST', body: { ...quien, ...movimiento } })
}

export function updateMovement(quien, id, movimiento) {
  return pedir(`/api/movements/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: { ...quien, ...movimiento },
  })
}

export function deleteMovement(quien, id) {
  return pedir(`/api/movements/${encodeURIComponent(id)}?${query(quien)}`, { method: 'DELETE' })
}
