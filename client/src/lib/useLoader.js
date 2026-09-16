import { useCallback, useEffect, useEffectEvent, useState } from 'react'

// Carga load(key) al montar y cada vez que cambia key, cancelando el pedido
// anterior. onLoaded recibe los datos; estado es 'loading' | 'ok' | 'error'.
// El resultado se guarda junto con la key y el intento que lo produjeron:
// si alguno cambió, el estado vuelve a 'loading' sin mostrar datos viejos.
export function useLoader(load, key, onLoaded) {
  const [intento, setIntento] = useState(0)
  const [resultado, setResultado] = useState(null)
  const alCargar = useEffectEvent(onLoaded)

  useEffect(() => {
    const controller = new AbortController()
    let vivo = true

    load(key, { signal: controller.signal })
      .then((data) => {
        if (!vivo) return
        alCargar(data)
        setResultado({ key, intento, estado: 'ok' })
      })
      .catch((err) => {
        if (vivo && err.name !== 'AbortError') setResultado({ key, intento, estado: 'error' })
      })

    return () => {
      vivo = false
      controller.abort()
    }
  }, [load, key, intento])

  const reintentar = useCallback(() => setIntento((n) => n + 1), [])

  const vigente = resultado?.key === key && resultado?.intento === intento
  return { estado: vigente ? resultado.estado : 'loading', reintentar }
}
