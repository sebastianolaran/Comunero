import { leerSesion } from './session'

// El bien del usuario que entró. Se lee en cada llamada y no una vez al
// importar el módulo: en una SPA, loguearse no recarga la página, así que un
// valor capturado al arranque se quedaría en null para siempre.
export function assetIdActual() {
  return leerSesion()?.assetId ?? null
}

export function assetNameActual() {
  return leerSesion()?.assetName ?? null
}
