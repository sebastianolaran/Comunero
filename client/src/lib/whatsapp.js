// Mensajes de WhatsApp listos para mandar con un toque: abren el chat con el
// texto escrito y alguien toca Enviar (no hay envío automático).
import { formatMoney, formatRange } from './rentalRequests.js'

// wa.me pide el número internacional sin "+". Los teléfonos se guardan solo en
// dígitos y casi siempre sin código de país: un celular argentino es 549 + área + número.
export function telefonoWhatsApp(digitos) {
  if (!digitos) return null
  const sinCero = digitos.replace(/^0/, '')
  if (sinCero.length === 10) return `549${sinCero}`
  if (/^54(?!9)\d{10}$/.test(sinCero)) return `549${sinCero.slice(2)}`
  return sinCero
}

export function linkWhatsApp(texto, telefono = null) {
  return `https://wa.me/${telefono ?? ''}?text=${encodeURIComponent(texto)}`
}

const nombreDePila = (nombre) => (nombre ?? '').trim().split(/\s+/)[0]
const personas = (n) => (n == null ? null : `${n} ${n === 1 ? 'persona' : 'personas'}`)

function detalle({ startDate, endDate, guests }) {
  return [formatRange(startDate, endDate), personas(guests)].filter(Boolean).join(', ')
}

// Del copropietario al inquilino, según cómo está la solicitud.
export function mensajeInquilino(solicitud, nombreDelBien) {
  const saludo = `Hola ${nombreDePila(solicitud.renterName)}.`
  const pedido = `el pedido para ${nombreDelBien} (${detalle(solicitud)})`
  if (solicitud.status === 'APPROVED') {
    const total = solicitud.amount == null ? '' : ` El total es ${formatMoney(solicitud.amount)}.`
    return `${saludo} Quedó aprobado ${pedido}.${total} Para confirmar la reserva, coordinar el pago por acá.`
  }
  if (solicitud.status === 'REJECTED') {
    return `${saludo} Sobre ${pedido}: no hay disponibilidad en esas fechas. Gracias por la consulta.`
  }
  return `${saludo} Se recibió ${pedido}. Se está revisando y en breve hay una respuesta.`
}

// Para el grupo de los copropietarios cuando entra una solicitud desde la ficha.
export function mensajeGrupo(solicitud, nombreDelBien, linkAlquiler) {
  const monto = solicitud.amount == null ? null : formatMoney(solicitud.amount)
  const datos = [solicitud.renterName, detalle(solicitud), monto].filter(Boolean).join(' · ')
  return `Nueva solicitud desde la ficha de ${nombreDelBien}: ${datos}. Para votar: ${linkAlquiler}`
}
