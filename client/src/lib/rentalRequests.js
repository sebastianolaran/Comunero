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
