import { fmtAprobaron, fmtFechaHora, fmtMoney, fmtRango } from './format.js'

const MS_POR_DIA = 24 * 60 * 60 * 1000

// No ordena: el server ya las manda de la más reciente a la más antigua.
export function agrupar(solicitudes) {
  return {
    pendientes: solicitudes.filter((s) => s.status === 'PENDING'),
    resueltas: solicitudes.filter((s) => s.status !== 'PENDING'),
  }
}

// Misma regla que el server: una rechazada sigue abierta para todos, salvo que se
// pise con una reserva aprobada, que sea un alquiler cancelado o que haya vencido.
export function puedeVotar({ status, startDate, blockedByOverlap = false, cancelled = false, expired = false }) {
  return status !== 'APPROVED' && !blockedByOverlap && !cancelled && !expired && !fechaPasada({ status, startDate })
}

// Un pedido que sigue en votación cuando su fecha ya empezó no tiene sentido votarlo.
export function fechaPasada({ status, startDate }) {
  return status === 'PENDING' && Boolean(startDate) && startDate.slice(0, 10) < hoyLocal()
}

export function personasLabel(guests) {
  if (guests == null) return null
  return guests === 1 ? '1 persona' : `${guests} personas`
}

// Mismo criterio que el server: el monto se corrige mientras no esté aprobada y
// antes de que voten los demás.
export function puedeEditarMonto({ status, cancelled = false, expired = false, votes = [] }, userId) {
  const otrosVotaron = votes.some((v) => v.userId !== userId && v.value !== null)
  return status !== 'APPROVED' && !cancelled && !expired && !otrosVotaron
}

// El motivo es opcional al rechazar.
export function validarVoto({ value, reason = '' }) {
  const motivo = reason.trim()
  if (value === 'APPROVE' || !motivo) return { voto: { value } }
  return { voto: { value, reason: motivo } }
}

export function motivoRechazo(reason) {
  return reason || 'Sin motivo especificado'
}

// Una solicitud cerrada puede tener integrantes sin voto (se sumaron después o
// el plazo venció): ya no "faltan", así que se dice sin dejarlo pendiente.
export function votosLabel({ yesCount, coownerCount, status, votes = [] }) {
  const base = fmtAprobaron(yesCount, coownerCount)
  const sinVoto = votes.filter((v) => !v.value).length
  if (status === 'PENDING' || sinVoto === 0) return base
  return `${base} · ${sinVoto} sin votar`
}

const MS_POR_HORA = 60 * 60 * 1000

// "Vence el 2 nov 2026, 14:00" mientras se vota y hay tiempo para responder.
// Sin plazo cargado no vence: se dice para que nadie espere un cierre solo.
export function textoPlazo({ status, requestedAt }, plazoHoras) {
  if (status !== 'PENDING' || !requestedAt || plazoHoras === undefined) return null
  if (plazoHoras == null) return 'Sin plazo: sigue abierta hasta que voten todos'
  const vence = new Date(new Date(requestedAt).getTime() + plazoHoras * MS_POR_HORA)
  return `Vence el ${fmtFechaHora(vence.toISOString())}`
}

export function textoSinVoto(votes) {
  const sinVoto = votes.filter((v) => !v.value).map((v) => v.name)
  if (sinVoto.length === 0) return null
  return new Intl.ListFormat('es', { type: 'conjunction' }).format(sinVoto)
}

const lista = (nombres) => new Intl.ListFormat('es', { type: 'conjunction' }).format(nombres)

// Por qué terminó la votación, en una oración: quién votó No, si venció el
// plazo o si se aprobó sin el voto de alguien. null si sigue abierta, se
// canceló o el motivo ya lo dice el server (por ejemplo, un solapamiento).
export function textoCierre({ status, cancelled = false, expired = false, votes = [] }) {
  if (cancelled) return null
  const sinVoto = textoSinVoto(votes)
  if (status === 'APPROVED') return sinVoto ? `Aprobada sin el voto de ${sinVoto}.` : 'Aprobada por unanimidad.'
  if (status !== 'REJECTED') return null
  const dijeronNo = votes.filter((v) => v.value === 'REJECT').map((v) => v.name)
  if (dijeronNo.length > 0) return `Rechazada: ${lista(dijeronNo)} ${dijeronNo.length === 1 ? 'votó' : 'votaron'} No.`
  if (expired) return sinVoto ? `Rechazada al vencer el plazo sin el voto de ${sinVoto}.` : 'Rechazada al vencer el plazo.'
  return null
}

const CHIPS = {
  APPROVE: { simbolo: '✓', verbo: 'aprobó', variante: 'aprobo' },
  REJECT: { simbolo: '✕', verbo: 'rechazó', variante: 'rechazo' },
}
const CHIP_PENDIENTE = { simbolo: '·', verbo: 'todavía no votó', variante: 'pendiente' }
const CHIP_SIN_VOTO = { simbolo: '·', verbo: 'no votó', variante: 'pendiente' }

export function chipVoto({ name, value }, cerrada = false) {
  const { simbolo, verbo, variante } = CHIPS[value] ?? (cerrada ? CHIP_SIN_VOTO : CHIP_PENDIENTE)
  return { label: `${name} ${simbolo}`, descripcion: `${name} ${verbo}`, variante }
}

export function formatMoney(monto) {
  return monto == null ? null : fmtMoney(monto)
}

// El server guarda solo dígitos con código de país (5491155551234).
export function formatPhone(phone) {
  const caba = /^54911(\d{4})(\d{4})$/.exec(phone ?? '')
  return caba ? `11 ${caba[1]}-${caba[2]}` : phone
}

export { fmtRango as formatRange }

function utc(fecha) {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  return Date.UTC(anio, mes - 1, dia)
}

export function daysLabel(desde, hasta = desde) {
  const dias = Math.max(1, (utc(hasta) - utc(desde)) / MS_POR_DIA + 1)
  return dias === 1 ? '1 día' : `${dias} días`
}

// Monto que se completa solo con el precio por día de Configuración, o null si
// no hay precio o las fechas no arman un rango. texto va con punto de miles,
// como lo acepta el campo.
export function montoSugerido(desde, hasta, precioPorDia) {
  if (precioPorDia == null || !desde || !hasta || desde > hasta) return null
  const dias = (utc(hasta) - utc(desde)) / MS_POR_DIA + 1
  const monto = dias * precioPorDia
  return { monto, texto: monto.toLocaleString('es-AR'), detalle: `${daysLabel(desde, hasta)} × ${formatMoney(precioPorDia)}` }
}

export const ESTADOS = {
  PENDING: 'En votación',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
}

// El server la trata como rechazada, pero se muestra aparte.
export function textoEstado({ status, cancelled }) {
  return cancelled ? 'Cancelada' : (ESTADOS[status] ?? status)
}

export const VOTO_TEXTO = { APPROVE: 'Sí', REJECT: 'No' }

// El pago solo existe para un alquiler aprobado.
export function etiquetaPago({ status, paid }) {
  if (status !== 'APPROVED') return null
  return paid ? 'Pago' : 'Pendiente de pago'
}

// Pago es final: no se vuelve a Pendiente.
export function puedeMarcarPago({ status, paid }) {
  return status === 'APPROVED' && !paid
}

// Una vez pago ya no se puede cancelar.
export function puedeCancelar({ status, paid }) {
  return status === 'APPROVED' && !paid
}

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
  else if (desde < hoy) errores.desde = 'La fecha de inicio no puede ser anterior a hoy.'
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

// "Falta que voten Bruno y Carla." para una solicitud en votación; null si ya votaron todos.
export function textoFaltan(votes) {
  const faltan = votes.filter((v) => !v.value).map((v) => v.name)
  if (faltan.length === 0) return null
  const nombres = new Intl.ListFormat('es', { type: 'conjunction' }).format(faltan)
  return faltan.length === 1 ? `Falta que vote ${nombres}.` : `Falta que voten ${nombres}.`
}
