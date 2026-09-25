import { colorDeIntegrante, diasDelMes, primerDiaSemana } from './calendar.js'

// Mismo criterio que el server: un arroba, algo antes, y un punto después.
// No pretende decidir si el mail existe (eso lo dice el 401), solo evita
// mandar a la API algo que claramente no es un mail.
const MAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validarLogin({ email, password }) {
  const errores = {}
  const mail = email.trim()

  if (!mail) errores.email = 'Ingresá tu mail.'
  else if (!MAIL_RE.test(mail)) errores.email = 'Revisá el mail: le falta algo.'

  // La contraseña no se recorta: los espacios son parte de la contraseña.
  if (!password) errores.pass = 'Ingresá tu contraseña.'

  return errores
}

// Turnos de ejemplo del panel de la izquierda. Es una ilustración de cómo se
// ve un mes en la app: en la pantalla de login todavía no hay sesión, así que
// no hay ningún bien al que pedirle las reservas de verdad.
const TURNOS_DE_EJEMPLO = [
  { desde: 3, hasta: 5, integrante: 'ejemplo-1' },
  { desde: 9, hasta: 10, integrante: 'ejemplo-5', pendiente: true },
  { desde: 14, hasta: 16, integrante: 'ejemplo-3' },
  { desde: 21, hasta: 23, alquiler: true },
  { desde: 27, hasta: 28, integrante: 'ejemplo-6' },
]

// Mismo teal que Alquilado en el calendario.
const COLOR_ALQUILER = 'oklch(52% 0.09 195)'

function turnoDelDia(dia) {
  return TURNOS_DE_EJEMPLO.find((t) => dia >= t.desde && dia <= t.hasta)
}

function colorDelTurno(turno) {
  if (!turno) return null
  return turno.alquiler ? COLOR_ALQUILER : colorDeIntegrante(turno.integrante)
}

// Celdas de la grilla del panel, en orden de lectura: primero los huecos de
// los días de la semana anteriores al 1, después un día por celda.
export function celdasDelPanel(year, month) {
  const huecos = Array.from({ length: primerDiaSemana(year, month) }, () => ({
    dia: null,
    color: null,
    pendiente: false,
  }))

  const dias = diasDelMes(year, month).map((fecha) => {
    const dia = fecha.getUTCDate()
    const turno = turnoDelDia(dia)

    return { dia, color: colorDelTurno(turno), pendiente: Boolean(turno?.pendiente) }
  })

  return [...huecos, ...dias]
}

// Leyenda del panel, con los mismos colores que la grilla.
export const LEYENDA_DEL_PANEL = [
  ...TURNOS_DE_EJEMPLO.filter((t) => t.integrante).map((t, i) => ({
    label: `Integrante ${i + 1}`,
    color: colorDeIntegrante(t.integrante),
  })),
  { label: 'Alquilado', color: COLOR_ALQUILER },
]
