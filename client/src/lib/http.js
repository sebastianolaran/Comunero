// fetch con errores para mostrarle a la gente: sin red o con el server caído,
// fetch rechaza con "Failed to fetch"; un status sin { error } del server se
// traduce según qué pasó. Cancelar (AbortError) sigue igual.
export const SIN_CONEXION = 'No hay conexión con el servidor. Intentar de nuevo en un momento.'

async function red(url, opciones) {
  try {
    return await fetch(url, opciones)
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw new Error(SIN_CONEXION)
  }
}

// Caché corto de lecturas: el server está lejos de la base y cada pantalla
// tarda en armarse, así que volver a una pantalla recién vista sale de acá.
// Cualquier escritura lo vacía entero: después de votar, guardar o saldar
// nunca se ve un dato propio viejo. Lo de otros integrantes llega a lo sumo
// FRESCURA_MS más tarde.
const FRESCURA_MS = 20_000
const cache = new Map() // url -> { desde, respuesta: Promise<{ status, tipo, cuerpo }> }
const SIN_CACHE = ['/api/health']

export function vaciarCache() {
  cache.clear()
}

const aResponse = ({ status, tipo, cuerpo }) =>
  new Response(status === 204 ? null : cuerpo, { status, headers: tipo ? { 'Content-Type': tipo } : {} })

// La lectura compartida no se cancela con la señal de quien la pidió (otro
// puede estar esperándola): cada uno deja de esperar con su propia señal.
function esperar(promesa, signal) {
  if (!signal) return promesa
  if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'))
  return new Promise((resolver, rechazar) => {
    const cortar = () => rechazar(new DOMException('Aborted', 'AbortError'))
    signal.addEventListener('abort', cortar, { once: true })
    promesa.then(resolver, rechazar).finally(() => signal.removeEventListener('abort', cortar))
  })
}

export async function pedir(url, opciones = {}) {
  const metodo = (opciones.method ?? 'GET').toUpperCase()
  if (metodo !== 'GET') {
    vaciarCache()
    return red(url, opciones)
  }
  if (SIN_CACHE.some((ruta) => url.includes(ruta))) return red(url, opciones)

  const guardada = cache.get(url)
  if (guardada && Date.now() - guardada.desde < FRESCURA_MS) return aResponse(await esperar(guardada.respuesta, opciones.signal))

  const { signal, ...resto } = opciones
  const respuesta = red(url, resto).then(async (res) => ({
    status: res.status,
    tipo: res.headers.get('Content-Type'),
    cuerpo: await res.text(),
  }))
  const entrada = { desde: Date.now(), respuesta }
  cache.set(url, entrada)
  // Los errores no se guardan: el próximo intento vuelve a la red.
  respuesta.then(
    (r) => r.status >= 400 && cache.get(url) === entrada && cache.delete(url),
    () => cache.get(url) === entrada && cache.delete(url),
  )
  return aResponse(await esperar(respuesta, signal))
}

const POR_STATUS = {
  403: 'No hay permiso para hacer esto en este bien.',
  404: 'No encontramos lo que buscabas: puede que alguien lo haya borrado.',
  409: 'Alguien cambió esto mientras tanto. Recargar e intentar de nuevo.',
  429: 'Demasiados intentos seguidos. Esperar un momento e intentar de nuevo.',
}

export function mensajeHttp(status) {
  if (POR_STATUS[status]) return POR_STATUS[status]
  if (status >= 500) return 'El servidor tuvo un problema. Intentar de nuevo en un momento.'
  return 'No se pudo completar el pedido. Intentar de nuevo.'
}
