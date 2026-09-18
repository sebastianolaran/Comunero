import { daysLabel, formatRange, votosLabel } from '../lib/rentalRequests'

const ESTADOS = {
  PENDING: 'En votación',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
}

function RentalRequestCard({ solicitud }) {
  const { renterName, startDate, endDate, status } = solicitud
  const pendiente = status === 'PENDING'
  const fechas = `${formatRange(startDate, endDate)} · ${daysLabel(startDate, endDate)}`
  const votos = `${votosLabel(solicitud)} votos a favor`

  return (
    <article className={`solicitud${pendiente ? '' : ' is-resuelta'}`}>
      <div className="solicitud-cabecera">
        <h3 className="solicitud-nombre">{renterName ?? 'Sin interesado'}</h3>
        <span className="solicitud-estado">{ESTADOS[status] ?? status}</span>
      </div>

      {pendiente ? (
        <>
          <p className="solicitud-meta">{fechas}</p>
          <p className="solicitud-votos">{votos}</p>
        </>
      ) : (
        <p className="solicitud-meta">{`${fechas} · ${votos}`}</p>
      )}
    </article>
  )
}

export default RentalRequestCard
