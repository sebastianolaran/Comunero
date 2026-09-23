export const MENSAJE_SIN_INQUILINOS = 'Todavía no hay inquilinos con alquileres terminados'
export const MENSAJE_SIN_COINCIDENCIAS = 'No hay inquilinos que coincidan con la búsqueda'

const CLASIFICACIONES = {
  RECOMMENDED: { label: 'Recomendado', variante: 'solida' },
  NOT_RECOMMENDED: { label: 'No recomendado', variante: 'normal' },
}
const SIN_DEFINIR = { label: 'Sin definir', variante: 'punteada' }

export function clasificacion(rating) {
  return CLASIFICACIONES[rating] ?? SIN_DEFINIR
}

export function alquileresLabel(cantidad) {
  return cantidad === 1 ? '1 alquiler' : `${cantidad} alquileres`
}

export function mensajeVacio(busqueda) {
  return busqueda.trim() === '' ? MENSAJE_SIN_INQUILINOS : MENSAJE_SIN_COINCIDENCIAS
}
