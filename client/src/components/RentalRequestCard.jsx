import {
  daysLabel,
  ESTADOS,
  etiquetaPago,
  formatMoney,
  formatPhone,
  formatRange,
  VOTO_TEXTO,
  votosLabel,
} from '../lib/rentalRequests'
import VoteChips from './VoteChips'

// La tarjeta entera selecciona con el mouse; con teclado se entra por el nombre.
const sinPropagar = (fn) => (e) => {
  e.stopPropagation()
  fn()
}

function RentalRequestCard({
  solicitud,
  seleccionada,
  puedeVotar,
  enviando,
  onSelect,
  onApprove,
  onOpenReject,
  onChangeVote,
}) {
  const { renterName, renterPhone, comments, startDate, endDate, status, vote } = solicitud
  const pendiente = status === 'PENDING'
  const fechas = formatRange(startDate, endDate)
  const dias = daysLabel(startDate, endDate)
  const monto = formatMoney(solicitud.amount)
  const pago = etiquetaPago(solicitud)
  const clases = ['solicitud', seleccionada && 'is-seleccionada', !pendiente && 'is-resuelta']

  return (
    <article className={clases.filter(Boolean).join(' ')} onClick={onSelect}>
      <div className="solicitud-cabecera">
        <h3 className="solicitud-nombre">
          <button
            type="button"
            className="solicitud-abrir"
            aria-current={seleccionada || undefined}
            onClick={sinPropagar(onSelect)}
          >
            {renterName ?? 'Sin interesado'}
          </button>
        </h3>
        <span className="solicitud-badges">
          <span className="solicitud-estado">{ESTADOS[status] ?? status}</span>
          {pago && <span className={`solicitud-estado is-pago${solicitud.paid ? ' is-pagado' : ''}`}>{pago}</span>}
        </span>
      </div>

      {pendiente ? (
        <>
          <p className="solicitud-meta">
            {[formatPhone(renterPhone), fechas, dias, monto].filter(Boolean).join(' · ')}
          </p>
          {comments && <p className="solicitud-comentario">{comments}</p>}
          <div className="solicitud-votos">
            <span className="solicitud-votos-texto">{votosLabel(solicitud)}</span>
            <VoteChips votes={solicitud.votes} />
          </div>

          {puedeVotar &&
            (vote ? (
              <div className="voto-actual">
                <span>Tu voto: {VOTO_TEXTO[vote]}</span>
                <button type="button" className="voto-cambiar" onClick={sinPropagar(onChangeVote)}>
                  Cambiar voto
                </button>
              </div>
            ) : (
              <div className="voto-acciones">
                <button
                  type="button"
                  className="voto-boton"
                  onClick={sinPropagar(onApprove)}
                  disabled={enviando}
                >
                  Aprobar
                </button>
                <button
                  type="button"
                  className="voto-boton is-secundario"
                  onClick={sinPropagar(onOpenReject)}
                  disabled={enviando}
                >
                  Rechazar
                </button>
              </div>
            ))}
        </>
      ) : (
        <p className="solicitud-meta">
          {[fechas, dias, monto, votosLabel(solicitud)].filter(Boolean).join(' · ')}
        </p>
      )}
    </article>
  )
}

export default RentalRequestCard
