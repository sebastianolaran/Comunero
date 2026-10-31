import { useEffect, useState } from 'react'
import { fetchCoowners } from '../services/movement'
import { assetIdActual } from './currentAsset'
import { userIdActual } from './currentUser'

// userId -> tono del integrante en el bien actual, el mismo que se elige en
// Configuración. Se pide una vez por bien y queda en memoria; mientras no
// llega (o si falla), los puntos quedan en gris (colorConfirmado).
const porBien = new Map()

export function useTonos() {
  const assetId = assetIdActual()
  const userId = userIdActual()
  const [tonos, setTonos] = useState(() => porBien.get(assetId) ?? {})

  useEffect(() => {
    if (!assetId || !userId || porBien.has(assetId)) return undefined
    const controlador = new AbortController()
    fetchCoowners({ assetId, userId }, { signal: controlador.signal })
      .then((coowners) => {
        const mapa = Object.fromEntries(coowners.map((c) => [c.id, c.hue]))
        porBien.set(assetId, mapa)
        setTonos(mapa)
      })
      .catch(() => {})
    return () => controlador.abort()
  }, [assetId, userId])

  return tonos
}
