import {
  fechaPasada,
  puedeVotar as sePuedeVotar,
  daysLabel,
  formatMoney,
  formatPhone,
  formatRange,
  textoEstado,
  VOTO_TEXTO,
  votosLabel,
} from '../lib/rentalRequests'
import PagoTag from './PagoTag'
import { ChipsVoto } from './ui/Votacion'

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
  const votable = puedeVotar && sePuedeVotar(solicitud)
  const fechas = formatRange(startDate, endDate)
  const dias = daysLabel(startDate, endDate)
  const monto = formatMoney(solicitud.amount)
  const clases = ['card card--pad pick alq-rq', seleccionada && 'pick--on', !pendiente && 'alq-rq--resuelta']

  return (
    <article className={clases.filter(Boolean).join(' ')} onClick={onSelect}>
      <div className="alq-rq__head">
        <h3 className="alq-rq__name">
          <button
            type="button"
            className="alq-rq__open"
            aria-current={seleccionada || undefined}
            onClick={sinPropagar(onSelect)}
          >
            {renterName ?? 'Sin interesado'}
          </button>
        </h3>
        <span className="alq-badges">
          <PagoTag solicitud={solicitud} />
          {fechaPasada(solicitud) && <span className="tag tag--dash">Fecha pasada</span>}
          <span className="badge">{textoEstado(solicitud)}</span>
        </span>
      </div>

      {pendiente ? (
        <>
          <p className="meta alq-rq__meta">
            {[formatPhone(renterPhone), fechas, dias, monto].filter(Boolean).join(' · ')}
          </p>
          {comments && <p className="alq-rq__com">{comments}</p>}
          <div className="alq-rq__votos">
            <span className="meta">{votosLabel(solicitud)}</span>
            <ChipsVoto votes={solicitud.votes} />
          </div>

          {fechaPasada(solicitud) && (
            <p className="hint alq-rq__aviso">La fecha ya pasó: no se puede votar.</p>
          )}
          {!fechaPasada(solicitud) && solicitud.blockedByOverlap && (
            <p className="hint alq-rq__aviso">Se pisa con una reserva aprobada: no se puede votar mientras siga en pie.</p>
          )}
          {votable &&
            (vote ? (
              <div className="alq-mivoto">
                <span>Voto propio: {VOTO_TEXTO[vote]}</span>
                <button type="button" className="btn btn--link" onClick={sinPropagar(onChangeVote)}>
                  Cambiar voto
                </button>
              </div>
            ) : (
              <div className="alq-acciones">
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={sinPropagar(onApprove)}
                  disabled={enviando}
                >
                  Aprobar
                </button>
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={sinPropagar(onOpenReject)}
                  disabled={enviando}
                >
                  Rechazar
                </button>
              </div>
            ))}
        </>
      ) : (
        <p className="meta">
          {[fechas, dias, monto, votosLabel(solicitud)].filter(Boolean).join(' · ')}
        </p>
      )}
    </article>
  )
}

export default RentalRequestCard
