// Sesión del usuario que entró: quién es y a qué bien pertenece. Vive en
// localStorage para que recargar la página no obligue a loguearse de nuevo.
export const CLAVE_SESION = 'comunero.sesion'

// El storage se pide en cada llamada y no al importar el módulo: en un
// navegador con las cookies bloqueadas, `localStorage` tira apenas se lo toca,
// y eso no tiene que impedir que la app cargue.
function storage() {
  return globalThis.localStorage ?? null
}

export function leerSesion() {
  try {
    const guardado = storage()?.getItem(CLAVE_SESION)
    if (!guardado) return null

    const sesion = JSON.parse(guardado)
    // Un JSON válido pero sin id es basura de una versión anterior: mejor
    // tratarlo como "no hay nadie" que dejar la app a medio loguear.
    return sesion?.id ? sesion : null
  } catch {
    return null
  }
}

export function guardarSesion(usuario) {
  try {
    storage()?.setItem(CLAVE_SESION, JSON.stringify(usuario))
  } catch {
    // Sin storage la sesión dura lo que dure la pestaña: molesto, pero no
    // es motivo para cortarle el paso a quien ya se logueó bien.
  }
}

export function cerrarSesion() {
  try {
    storage()?.removeItem(CLAVE_SESION)
  } catch {
    // Nada que hacer: si no se puede escribir, tampoco se pudo guardar.
  }
}
