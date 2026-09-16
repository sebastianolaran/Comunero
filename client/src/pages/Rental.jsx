import { useId, useState } from 'react'
import LoadState from '../components/LoadState'
import RentalRequestCard from '../components/RentalRequestCard'
import { useLoader } from '../lib/useLoader'
import { fetchRentalRequests } from '../services/rentalRequest'
import './Rental.css'

// Alquiler a terceros > Solicitudes: listado de solo lectura, separado en
// pendientes de aprobación (en votación) y resueltas (aprobadas o
// rechazadas). Votar, el detalle y el resto de la sección llegan con sus
// propias historias.
function Rental({ assetId }) {
  const [solicitudes, setSolicitudes] = useState([])
  const carga = useLoader(fetchRentalRequests, assetId, setSolicitudes)
  const idPendientes = useId()
  const idResueltas = useId()

  if (carga.estado !== 'ok') {
    return <LoadState estado={carga.estado} onRetry={carga.reintentar} />
  }

  if (solicitudes.length === 0) {
    return <p className="notice">Todavía no hay solicitudes de alquiler para este bien.</p>
  }

  const pendientes = solicitudes.filter((s) => s.status === 'PENDING')
  const resueltas = solicitudes.filter((s) => s.status !== 'PENDING')

  return (
    <div className="rental">
      <section aria-labelledby={idPendientes}>
        <h2 id={idPendientes} className="section-label">
          Pendientes de aprobación
        </h2>
        {pendientes.length === 0 ? (
          <p className="empty">No hay solicitudes esperando votación.</p>
        ) : (
          <div className="card-list">
            {pendientes.map((s) => (
              <RentalRequestCard key={s.id} solicitud={s} />
            ))}
          </div>
        )}
      </section>

      {resueltas.length > 0 && (
        <section aria-labelledby={idResueltas}>
          <h2 id={idResueltas} className="section-label">
            Resueltas
          </h2>
          <div className="card-list card-list--compact">
            {resueltas.map((s) => (
              <RentalRequestCard key={s.id} solicitud={s} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export default Rental
