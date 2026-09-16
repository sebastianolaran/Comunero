const RESULTADOS = {
  APPROVED: { texto: 'Aprobada', clase: 'is-ok' },
  REJECTED: { texto: 'Rechazada', clase: 'is-error' },
}

// "2027-01-10" -> "10/01/2027". Se arma a mano para no pasar por Date y que
// la zona horaria no corra el día.
function formatearFecha(fecha) {
  const [anio, mes, dia] = fecha.split('-')
  return `${dia}/${mes}/${anio}`
}

function RentalRequestCard({ solicitud }) {
  const { tenantName, startDate, endDate, yesCount, coownerCount, status } = solicitud
  const resultado = RESULTADOS[status]

  return (
    <li className="rental-card">
      <div>
        <p className="rental-card__tenant">{tenantName}</p>
        <p className="rental-card__dates">
          {formatearFecha(startDate)} – {formatearFecha(endDate)}
        </p>
      </div>

      {resultado ? (
        <span className={`badge ${resultado.clase}`}>{resultado.texto}</span>
      ) : (
        <span className="rental-card__votes">
          {yesCount} de {coownerCount} votos a favor
        </span>
      )}
    </li>
  )
}

export default RentalRequestCard
