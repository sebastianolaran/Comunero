import {
  fechaPasada,
  puedeVotar as sePuedeVotar,
  daysLabel,
  formatMoney,
  formatPhone,
  formatRange,
  personasLabel,
  textoCierre,
  textoEstado,
  textoPlazo,
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
  plazoHoras,
  enviando,
  onSelect,
  onApprove,
  onOpenReject,
  onChangeVote,
  recienAprobada = false,
}) {
  const { renterName, renterPhone, comments, startDate, endDate, status, vote } = solicitud
  const pendiente = status === 'PENDING'
  const votable = puedeVotar && sePuedeVotar(solicitud)
  const fechas = formatRange(startDate, endDate)
  const dias = daysLabel(startDate, endDate)
  const monto = formatMoney(solicitud.amount)
  // Lo que explica el cierre: quién votó No o si venció; si no, el motivo del server (por ejemplo, un solapamiento).
  const cierre =
    textoCierre(solicitud) ??
    (status === 'REJECTED' && !solicitud.cancelled ? solicitud.rejectionReason : null)
  const clases = [
    'card card--pad pick alq-rq',
    seleccionada && 'pick--on',
    !pendiente && 'alq-rq--resuelta',
    recienAprobada && 'card--flash',
  ]

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
          {solicitud.fromListing && <span className="badge badge--line">Ficha pública</span>}
          <span className="badge">{textoEstado(solicitud)}</span>
          <PagoTag solicitud={solicitud} />
          {fechaPasada(solicitud) && <span className="tag tag--dash">Fecha pasada</span>}
        </span>
      </div>

      {pendiente ? (
        <>
          <p className="meta alq-rq__meta">
            {[formatPhone(renterPhone), fechas, dias, personasLabel(solicitud.guests), monto].filter(Boolean).join(' · ')}
          </p>
          {comments && <p className="alq-rq__com">{comments}</p>}
          <div className="alq-rq__votos">
            <span className="meta">
              {[votosLabel(solicitud), plazoHoras != null && textoPlazo(solicitud, plazoHoras)].filter(Boolean).join(' · ')}
            </span>
            <ChipsVoto votes={solicitud.votes} cerrada={solicitud.status !== 'PENDING'} />
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
          {cierre && (
            <>
              <br />
              {cierre}
            </>
          )}
        </p>
      )}
    </article>
  )
}

export default RentalRequestCard
