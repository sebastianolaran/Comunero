import { useId, useState } from 'react'
import { daysLabel, ESTADOS, formatMoney, formatPhone, formatRange, VOTO_TEXTO, votosLabel } from '../lib/rentalRequests'
import VoteChips from './VoteChips'

// modo: 'ver' | 'rechazar' | 'cambiar' (Cambiar voto vuelve a mostrar Aprobar/Rechazar).
function RentalRequestDetail({
  solicitud,
  modo,
  envio,
  puedeVotar,
  onApprove,
  onOpenReject,
  onCancelReject,
  onSubmitReject,
  onChangeVote,
}) {
  const [motivo, setMotivo] = useState('')
  const idError = useId()

  if (!solicitud) {
    return (
      <aside className="detalle" aria-label="Detalle de la solicitud">
        <p className="detalle-vacio">
          Elegí una solicitud para ver el detalle completo, la votación y las objeciones.
        </p>
      </aside>
    )
  }

  const { renterName, renterPhone, comments, startDate, endDate, status, vote, rejections } = solicitud
  const nombre = renterName ?? 'Sin interesado'
  const pendiente = status === 'PENDING'
  const rechazando = pendiente && modo === 'rechazar'
  const mostrarVotar = pendiente && !rechazando && (!vote || modo === 'cambiar')
  const mostrarMiVoto = pendiente && !rechazando && vote && modo !== 'cambiar'

  return (
    <aside className="detalle" aria-label={`Detalle de la solicitud de ${nombre}`}>
      <h2 className="detalle-nombre">{nombre}</h2>
      {renterPhone && <p className="detalle-contacto">{formatPhone(renterPhone)}</p>}
      <div className="detalle-badges">
        <span className="solicitud-estado">{ESTADOS[status] ?? status}</span>
      </div>
      <p className="detalle-fechas">
        {`${formatRange(startDate, endDate)} · ${daysLabel(startDate, endDate)}`}
        {solicitud.amount != null && (
          <>
            <br />
            {formatMoney(solicitud.amount)}
          </>
        )}
      </p>
      {comments && <p className="detalle-comentario">{comments}</p>}

      <h3 className="detalle-seccion">Votación · {votosLabel(solicitud)}</h3>
      <VoteChips votes={solicitud.votes} />

      {rejections.length > 0 && (
        <ul className="detalle-objeciones">
          {rejections.map((r) => (
            <li key={`${r.name}-${r.reason}`}>
              Objeción de {r.name}: {r.reason}
            </li>
          ))}
        </ul>
      )}

      {status === 'APPROVED' && (
        <p className="detalle-nota">Aprobada por unanimidad: ya quedó reservada en el calendario.</p>
      )}

      {!puedeVotar && pendiente && (
        <p className="detalle-nota">
          Configurá <code>VITE_DEMO_USER_ID</code> para poder votar.
        </p>
      )}

      {puedeVotar && mostrarVotar && (
        <div className="detalle-acciones">
          <button
            type="button"
            className="detalle-boton is-primario"
            onClick={onApprove}
            disabled={envio.enviando}
          >
            Aprobar
          </button>
          <button type="button" className="detalle-boton" onClick={onOpenReject} disabled={envio.enviando}>
            Rechazar
          </button>
        </div>
      )}

      {puedeVotar && mostrarMiVoto && (
        <div className="voto-actual is-detalle">
          <span>Tu voto: {VOTO_TEXTO[vote]}</span>
          <button type="button" className="voto-cambiar" onClick={onChangeVote}>
            Cambiar voto
          </button>
        </div>
      )}

      {puedeVotar && rechazando && (
        <div className="detalle-rechazo">
          <textarea
            className="detalle-motivo"
            placeholder="Motivo del rechazo"
            aria-label="Motivo del rechazo"
            maxLength={500}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            aria-invalid={envio.error ? true : undefined}
            aria-describedby={envio.error ? idError : undefined}
          />
          <div className="detalle-acciones">
            <button type="button" className="detalle-boton" onClick={onCancelReject} disabled={envio.enviando}>
              Volver
            </button>
            <button
              type="button"
              className="detalle-boton is-confirmar"
              onClick={() => onSubmitReject(motivo)}
              disabled={envio.enviando}
            >
              Confirmar rechazo
            </button>
          </div>
        </div>
      )}

      {envio.error && (
        <p id={idError} className="voto-error" role="alert">
          {envio.error}
        </p>
      )}
    </aside>
  )
}

export default RentalRequestDetail
