import { API_URL } from '../lib/api'

// { net, coowners }: tu balance con cada uno de los demás copropietarios del
// bien, con el detalle que lo compone.
// TODO: el userId sale de la sesión cuando exista el login.
export async function fetchBalances({ assetId, userId }, { signal } = {}) {
  const params = new URLSearchParams({ assetId, userId })
  const res = await fetch(`${API_URL}/api/balances?${params}`, { signal })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
  return data
}

// Pago total de tu deuda con toUserId: cierra el balance entre los dos y
// devuelve el saldo cerrado. amount es el monto que se mostró en el modal; si
// el balance cambió en el medio, el error trae currentAmount con el monto
// actual.
// TODO: fromUserId sale de la sesión cuando exista el login.
export async function closeBalance({ assetId, fromUserId, toUserId, amount }) {
  const res = await fetch(`${API_URL}/api/balances/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assetId, fromUserId, toUserId, amount }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const err = new Error(data?.error ?? `HTTP ${res.status}`)
    err.currentAmount = data?.currentAmount
    throw err
  }
  return data
}
