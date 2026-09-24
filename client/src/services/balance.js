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
