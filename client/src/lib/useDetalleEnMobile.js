import { useEffect, useRef, useState } from 'react'

// En pantallas angostas el panel de detalle queda debajo de toda la lista: al
// elegir un ítem se lleva el panel a la vista y se le da el foco. Es un contador
// y no la selección para que volver a tocar el mismo ítem también funcione.
const ANGOSTA = '(max-width: 900px)'

export function useDetalleEnMobile() {
  const detalle = useRef(null)
  const [pedidos, setPedidos] = useState(0)

  useEffect(() => {
    if (pedidos === 0 || !window.matchMedia(ANGOSTA).matches) return
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    detalle.current?.scrollIntoView({ block: 'start', behavior: quieto ? 'auto' : 'smooth' })
    detalle.current?.focus({ preventScroll: true })
  }, [pedidos])

  const mostrar = () => setPedidos((n) => n + 1)

  return [detalle, mostrar]
}
