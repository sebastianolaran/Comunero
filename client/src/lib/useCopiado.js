import { useEffect, useRef, useState } from 'react'

// Sin permiso de portapapeles (o fuera de https) no rompe: devuelve false.
export async function copiarAlPortapapeles(texto) {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    return false
  }
}

export function useCopiado(duracionMs = 4000) {
  const [copiado, setCopiado] = useState(false)
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  async function copiar(texto) {
    const ok = await copiarAlPortapapeles(texto)
    setCopiado(ok)
    clearTimeout(timer.current)
    if (ok) timer.current = setTimeout(() => setCopiado(false), duracionMs)
    return ok
  }

  return { copiado, copiar }
}
