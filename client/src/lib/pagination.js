import { useState } from 'react'

export const PAGE_SIZE = 10

export function usePaginacion(items, resetKey = '') {
  const [estado, setEstado] = useState({ pagina: 1, resetKey })
  const totalPaginas = Math.max(1, Math.ceil(items.length / PAGE_SIZE))

  const paginaVisible = estado.resetKey === resetKey ? Math.min(estado.pagina, totalPaginas) : 1
  const inicio = (paginaVisible - 1) * PAGE_SIZE

  return {
    pagina: paginaVisible,
    totalPaginas,
    elementos: items.slice(inicio, inicio + PAGE_SIZE),
    setPagina: (pagina) => setEstado({ pagina, resetKey }),
  }
}