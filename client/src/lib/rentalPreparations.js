const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

// Las fechas se parsean a mano para que la zona horaria local no corra el día.
function corto(fecha) {
  const [, mes, dia] = fecha.split('-').map(Number)
  return `${dia} ${MESES[mes - 1]}`
}

// Mismo formato que Solicitudes: un día "20 ago 2026", un rango "4 sep – 6 sep 2026".
export function formatRange(desde, hasta = desde) {
  const anioDesde = desde.slice(0, 4)
  const anioHasta = hasta.slice(0, 4)
  if (desde === hasta) return `${corto(desde)} ${anioHasta}`
  if (anioDesde !== anioHasta) return `${corto(desde)} ${anioDesde} – ${corto(hasta)} ${anioHasta}`
  return `${corto(desde)} – ${corto(hasta)} ${anioHasta}`
}

// 'sin-tareas' | 'pendientes' | 'listo'. Se calcula siempre desde los conteos
// que manda el server; nadie lo marca a mano.
export function resumenEstado({ total, pending }) {
  if (total === 0) return 'sin-tareas'
  return pending > 0 ? 'pendientes' : 'listo'
}

export function resumenLabel(resumen) {
  const { total, completed, pending } = resumen

  switch (resumenEstado(resumen)) {
    case 'sin-tareas':
      return 'Sin tareas asignadas'
    case 'pendientes':
      return `${pending} ${pending === 1 ? 'pendiente' : 'pendientes'} de ${total}`
    default:
      return `Todo listo (${completed}/${total})`
  }
}

export const NOMBRE_MAX = 100

// Mismas reglas y mismos mensajes que el server (que las vuelve a validar):
// esto solo evita un viaje cuando el error es evidente. Devuelve todos los
// errores juntos, nombre primero. El largo se cuenta en caracteres (Array.from)
// y no en unidades UTF-16, igual que en el server.
export function validarTarea({ nombre, responsableId }) {
  const errores = []
  const limpio = nombre.trim()

  if (limpio === '') errores.push('Falta el nombre de la tarea')
  else if (Array.from(limpio).length > NOMBRE_MAX) {
    errores.push(`El nombre no puede superar los ${NOMBRE_MAX} caracteres`)
  }
  if (!responsableId) errores.push('Falta elegir un responsable')

  return errores
}

// Alquiler con estas tareas y el resumen recalculado. No muta el original. El
// server calcula el resumen al leer; esto lo replica para no tener que volver a
// pedir toda la lista (y perder lo escrito en las otras tarjetas).
function conResumen(alquiler, tasks) {
  const completed = tasks.filter((t) => t.completed).length

  return { ...alquiler, tasks, summary: { total: tasks.length, completed, pending: tasks.length - completed } }
}

// La tarea nueva va al final.
export function agregarTarea(alquiler, tarea) {
  return conResumen(alquiler, [...alquiler.tasks, tarea])
}

// Reemplaza la tarea con el mismo id (tildada o con otro responsable), en el mismo lugar.
export function actualizarTarea(alquiler, tarea) {
  return conResumen(
    alquiler,
    alquiler.tasks.map((t) => (t.id === tarea.id ? tarea : t)),
  )
}

export function quitarTarea(alquiler, tareaId) {
  return conResumen(
    alquiler,
    alquiler.tasks.filter((t) => t.id !== tareaId),
  )
}

const ERROR_GENERICO = 'No se pudo agregar la tarea. Probá de nuevo.'

// Los mensajes de un error del server: la lista `errors` si viene, si no `error`,
// y si la respuesta no tiene forma conocida, `generico` (cada acción trae el suyo).
export function mensajesDeRespuesta(body, generico = ERROR_GENERICO) {
  if (Array.isArray(body?.errors) && body.errors.length > 0) return body.errors
  if (typeof body?.error === 'string' && body.error !== '') return [body.error]
  return [generico]
}
