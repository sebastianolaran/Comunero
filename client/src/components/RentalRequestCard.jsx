import { daysLabel, formatRange } from '../lib/rental'

const ESTADOS = {
  PENDING: 'En votación',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
}

// Tarjeta del listado de solicitudes. Las pendientes muestran el contacto y
// el avance de la votación en su propia línea; las resueltas van compactas.
function RentalRequestCard({ solicitud }) {
  const { tenantName, contact, startDate, endDate, yesCount, coownerCount, status } = solicitud
  const pendiente = status === 'PENDING'
  const rango = formatRange(startDate, endDate)
  const dias = daysLabel(startDate, endDate)
  const votos = `${yesCount}/${coownerCount} aprobaron`

  return (
    <article className={`card${pendiente ? '' : ' is-resolved'}`}>
      <div className="card__head">
        <h3 className="card__title">{tenantName}</h3>
        <span className="badge">{ESTADOS[status] ?? status}</span>
      </div>

      {pendiente ? (
        <>
          <p className="card__meta">{`${contact} · ${rango} · ${dias}`}</p>
          <p className="card__votes">{votos}</p>
        </>
      ) : (
        <p className="card__meta">{`${rango} · ${dias} · ${votos}`}</p>
      )}
    </article>
  )
}

export default RentalRequestCard
