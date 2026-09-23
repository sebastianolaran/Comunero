import { formatRange, hoyLocal } from './rentalRequests.js'

export const MENSAJE_SIN_INQUILINOS = 'Todavía no hay inquilinos con alquileres terminados'
export const MENSAJE_SIN_COINCIDENCIAS = 'No hay inquilinos que coincidan con la búsqueda'
export const MENSAJE_SIN_OBSERVACIONES = 'Todavía no hay observaciones sobre este inquilino'
const OBSERVACION_VACIA = 'La observación no puede estar vacía'

const CLASIFICACIONES = {
  RECOMMENDED: { label: 'Recomendado', variante: 'solida' },
  NOT_RECOMMENDED: { label: 'No recomendado', variante: 'normal' },
}
const SIN_DEFINIR = { label: 'Sin definir', variante: 'punteada' }

// Sin definir se guarda como null.
export const OPCIONES_CLASIFICACION = [
  { value: 'RECOMMENDED', label: CLASIFICACIONES.RECOMMENDED.label },
  { value: 'NOT_RECOMMENDED', label: CLASIFICACIONES.NOT_RECOMMENDED.label },
  { value: null, label: SIN_DEFINIR.label },
]

export function clasificacion(rating) {
  return CLASIFICACIONES[rating] ?? SIN_DEFINIR
}

export function alquileresLabel(cantidad) {
  return cantidad === 1 ? '1 alquiler' : `${cantidad} alquileres`
}

export function mensajeVacio(busqueda) {
  return busqueda.trim() === '' ? MENSAJE_SIN_INQUILINOS : MENSAJE_SIN_COINCIDENCIAS
}

export function validarObservacion(texto) {
  const recortado = texto.trim()
  return recortado ? { texto: recortado } : { error: OBSERVACION_VACIA }
}

// La fecha es la del día en Argentina, no la del huso de quien mira.
export function observacionMeta({ author, createdAt }) {
  return `${author.name} · ${formatRange(hoyLocal(new Date(createdAt)))}`
}

export function conClasificacion(inquilinos, id, rating) {
  return inquilinos.map((i) => (i.id === id ? { ...i, rating } : i))
}
