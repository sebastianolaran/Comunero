import { etiquetaPago } from '../lib/rentalRequests'

// Solo un alquiler aprobado tiene pago: "Pago" sólido, "Pendiente de pago" punteado.
function PagoTag({ solicitud }) {
  const pago = etiquetaPago(solicitud)
  if (!pago) return null
  return <span className={solicitud.paid ? 'tag tag--solid' : 'tag tag--dash'}>{pago}</span>
}

export default PagoTag
