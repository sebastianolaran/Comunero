const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MS_POR_DIA = 24 * 60 * 60 * 1000

// No ordena: el server ya las manda de la más reciente a la más antigua.
export function agrupar(solicitudes) {
  return {
    pendientes: solicitudes.filter((s) => s.status === 'PENDING'),
    resueltas: solicitudes.filter((s) => s.status !== 'PENDING'),
  }
}

export function validarVoto({ value, reason = '' }) {
  if (value === 'APPROVE') return { voto: { value } }
  const motivo = reason.trim()
  if (!motivo) return { error: 'Para rechazar tenés que cargar el motivo.' }
  return { voto: { value, reason: motivo } }
}

export function votosLabel({ yesCount, coownerCount }) {
  return `${yesCount}/${coownerCount} aprobaron`
}

const CHIPS = {
  APPROVE: { simbolo: '✓', verbo: 'aprobó', variante: 'aprobo' },
  REJECT: { simbolo: '✕', verbo: 'rechazó', variante: 'rechazo' },
}
const CHIP_PENDIENTE = { simbolo: '·', verbo: 'todavía no votó', variante: 'pendiente' }

export function chipVoto({ name, value }) {
  const { simbolo, verbo, variante } = CHIPS[value] ?? CHIP_PENDIENTE
  return { label: `${name} ${simbolo}`, descripcion: `${name} ${verbo}`, variante }
}

export function formatMoney(monto) {
  return monto == null ? null : `$${monto.toLocaleString('es-AR')}`
}

// El server guarda solo dígitos con código de país (5491155551234).
export function formatPhone(phone) {
  const caba = /^54911(\d{4})(\d{4})$/.exec(phone ?? '')
  return caba ? `11 ${caba[1]}-${caba[2]}` : phone
}

// Las fechas se parsean a mano para que la zona horaria local no corra el día.
function corto(fecha) {
  const [, mes, dia] = fecha.split('-').map(Number)
  return `${dia} ${MESES[mes - 1]}`
}

export function formatRange(desde, hasta = desde) {
  const anioDesde = desde.slice(0, 4)
  const anioHasta = hasta.slice(0, 4)
  if (desde === hasta) return `${corto(desde)} ${anioHasta}`
  if (anioDesde !== anioHasta) return `${corto(desde)} ${anioDesde} – ${corto(hasta)} ${anioHasta}`
  return `${corto(desde)} – ${corto(hasta)} ${anioHasta}`
}

function utc(fecha) {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  return Date.UTC(anio, mes - 1, dia)
}

export function daysLabel(desde, hasta = desde) {
  const dias = Math.max(1, (utc(hasta) - utc(desde)) / MS_POR_DIA + 1)
  return dias === 1 ? '1 día' : `${dias} días`
}

export const ESTADOS = {
  PENDING: 'En votación',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
}

export const VOTO_TEXTO = { APPROVE: 'Sí', REJECT: 'No' }

const TELEFONO = /^[\d\s()+.-]+$/
const MONTO = /^-?\d+$/
// Tope del Int de la base.
const MONTO_MAXIMO = 2_147_483_647

// Misma fecha que usa el server (Buenos Aires), aunque el dispositivo esté en otra zona.
// en-CA formatea como YYYY-MM-DD.
const FECHA_ARGENTINA = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })

export function hoyLocal(ahora = new Date()) {
  return FECHA_ARGENTINA.format(ahora)
}

// Acepta "10.000" o "$10.000": los puntos son separadores de miles.
function parsearMonto(texto) {
  const limpio = texto.replace(/[\s$.]/g, '')
  if (limpio === '') return { error: 'Falta el monto.' }
  if (!MONTO.test(limpio)) return { error: 'El monto tiene que ser un número entero.' }
  const monto = Number(limpio)
  if (monto < 0) return { error: 'El monto no puede ser negativo.' }
  if (monto > MONTO_MAXIMO) return { error: 'El monto es demasiado grande.' }
  return { monto }
}

function erroresDeFechas(desde, hasta, hoy) {
  const errores = {}
  if (!desde) errores.desde = 'Falta la fecha de inicio.'
  else if (desde <= hoy) errores.desde = 'La fecha de inicio tiene que ser posterior a hoy.'
  if (!hasta) errores.hasta = 'Falta la fecha de fin.'
  else if (desde && desde > hasta) errores.hasta = 'La fecha de fin no puede ser anterior a la de inicio.'
  return errores
}

// Devuelve { errores } con un mensaje por campo, o { solicitud } lista para el POST.
export function validarSolicitud(borrador, hoy = hoyLocal()) {
  const nombre = borrador.nombre.trim()
  const apellido = borrador.apellido.trim()
  const telefono = borrador.telefono.trim()
  const { monto, error: errorMonto } = parsearMonto(borrador.monto)

  const errores = { ...erroresDeFechas(borrador.desde, borrador.hasta, hoy) }
  if (!nombre) errores.nombre = 'Falta el nombre.'
  if (!apellido) errores.apellido = 'Falta el apellido.'
  if (!telefono) errores.telefono = 'Falta el teléfono.'
  else if (!TELEFONO.test(telefono)) errores.telefono = 'El teléfono solo puede tener números.'
  if (errorMonto) errores.monto = errorMonto
  if (Object.keys(errores).length > 0) return { errores }

  const comentarios = borrador.comentarios.trim()
  return {
    solicitud: {
      firstName: nombre,
      lastName: apellido,
      phone: telefono,
      startDate: borrador.desde,
      endDate: borrador.hasta,
      amount: monto,
      comments: comentarios || null,
    },
  }
}

// El server marca el campo con el nombre del body; el form usa los suyos.
export const CAMPO_DEL_SERVER = {
  firstName: 'nombre',
  lastName: 'apellido',
  phone: 'telefono',
  startDate: 'desde',
  endDate: 'hasta',
  amount: 'monto',
  comments: 'comentarios',
}
