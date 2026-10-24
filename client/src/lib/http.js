// fetch con errores para mostrarle a la gente: sin red o con el server caído,
// fetch rechaza con "Failed to fetch"; un status sin { error } del server se
// traduce según qué pasó. Cancelar (AbortError) sigue igual.
export const SIN_CONEXION = 'No pudimos conectarnos con el servidor. Probá de nuevo en un momento.'

export async function pedir(url, opciones) {
  try {
    return await fetch(url, opciones)
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw new Error(SIN_CONEXION)
  }
}

const POR_STATUS = {
  403: 'No tenés permiso para hacer esto en este bien.',
  404: 'No encontramos lo que buscabas: puede que alguien lo haya borrado.',
  409: 'Alguien cambió esto mientras tanto. Recargá y probá de nuevo.',
  429: 'Hiciste muchos intentos seguidos. Esperá un momento y probá de nuevo.',
}

export function mensajeHttp(status) {
  if (POR_STATUS[status]) return POR_STATUS[status]
  if (status >= 500) return 'El servidor tuvo un problema. Probá de nuevo en un momento.'
  return 'No se pudo completar el pedido. Probá de nuevo.'
}
