import { leerSesion } from './session'

// Mismo criterio que assetIdActual: se resuelve en cada llamada, contra la
// sesión de quien entró.
export function userIdActual() {
  return leerSesion()?.id ?? null
}

export function userNameActual() {
  return leerSesion()?.name ?? null
}
