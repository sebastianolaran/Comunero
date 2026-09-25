import { useId, useState } from 'react'
import {
  daysLabel,
  ESTADOS,
  formatMoney,
  formatPhone,
  formatRange,
  motivoRechazo,
  puedeCancelar,
  puedeMarcarPago,
  puedeVotar as admiteVoto,
  VOTO_TEXTO,
  votosLabel,
} from '../lib/rentalRequests'
import PagoTag from './PagoTag'
import VoteChips from './VoteChips'

// Acciones sobre un alquiler aprobado: las dos piden confirmar porque no se pueden deshacer.
const ACCIONES = {
  pagar: {
    boton: 'Marcar como pago',
    confirmar: 'Confirmar pago',
    aviso: (s) =>
      `Se registra un ingreso de ${formatMoney(s.amount)} repartido entre todos. Después no se puede volver a Pendiente.`,
  },
  cancelar: {
    boton: 'Cancelar alquiler',
    confirmar: 'Confirmar cancelación',
    aviso: () => 'Los días quedan libres. Para volver a alquilarlos hay que cargar otra solicitud.',
  },
}

// modo: 'ver' | 'rechazar' | 'cambiar' | 'pagar' | 'cancelar' (Cambiar voto vuelve a mostrar
// Aprobar/Rechazar; pagar y cancelar muestran su confirmación).
function RentalRequestDetail({
  ref,
  solicitud,
  modo,
  envio,
  puedeVotar,
  onApprove,
  onOpenReject,
  onCancelReject,
  onSubmitReject,
  onChangeVote,
  onOpenAction,
  onCancelAction,
  onConfirmAction,
}) {
  const [motivo, setMotivo] = useState('')
  const idError = useId()

  if (!solicitud) {
    return (
      <aside ref={ref} tabIndex={-1} className="panel rail alq-det" aria-label="Detalle de la solicitud">
        <div className="empty empty--rail">
          <svg className="empty__i" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 5h16v11H8l-4 4z" />
            <path d="M8 9h8M8 12.5h5" />
          </svg>
          Elegí una solicitud para ver el detalle completo, la votación y las objeciones.
        </div>
      </aside>
    )
  }

  const { renterName, renterPhone, comments, startDate, endDate, status, vote, rejections, rejectionReason } = solicitud
  const nombre = renterName ?? 'Sin interesado'
  const pendiente = status === 'PENDING'
  const abierta = admiteVoto(solicitud)
  const rechazando = abierta && modo === 'rechazar'
  const mostrarVotar = abierta && !rechazando && (!vote || modo === 'cambiar')
  const mostrarMiVoto = abierta && !rechazando && vote && modo !== 'cambiar'
  const disponibles = {
    pagar: puedeMarcarPago(solicitud),
    cancelar: puedeCancelar(solicitud),
  }
  const confirmando = disponibles[modo] ? modo : null
  const botones = Object.keys(ACCIONES).filter((accion) => disponibles[accion])

  return (
    <aside ref={ref} tabIndex={-1} className="panel rail alq-det" aria-label={`Detalle de la solicitud de ${nombre}`}>
      <h2 className="alq-det__name">{nombre}</h2>
      {renterPhone && <p className="meta alq-det__contact">{formatPhone(renterPhone)}</p>}
      <div className="alq-badges alq-det__badges">
        <PagoTag solicitud={solicitud} />
        <span className="badge">{ESTADOS[status] ?? status}</span>
      </div>
      <p className="alq-det__fechas">
        {`${formatRange(startDate, endDate)} · ${daysLabel(startDate, endDate)}`}
        {solicitud.amount != null && (
          <>
            <br />
            {formatMoney(solicitud.amount)}
          </>
        )}
      </p>
      {comments && <p className="note alq-det__bloque">{comments}</p>}

      <h3 className="sect alq-det__sect">Votación · {votosLabel(solicitud)}</h3>
      <VoteChips votes={solicitud.votes} />

      {(rejections.length > 0 || rejectionReason) && (
        <ul className="alq-det__objeciones">
          {rejectionReason && <li className="note">{rejectionReason}</li>}
          {rejections.map((r, i) => (
            <li key={r.name ?? i} className="note">
              Objeción de {r.name}: {motivoRechazo(r.reason)}
            </li>
          ))}
        </ul>
      )}

      {solicitud.blockedByOverlap && (
        <p className="hint alq-det__bloque">
          Se pisa con una reserva aprobada: no se puede votar mientras esa reserva siga en pie.
        </p>
      )}

      {status === 'APPROVED' && (
        <p className="hint alq-det__bloque">Aprobada por unanimidad: ya quedó reservada en el calendario.</p>
      )}

      {puedeVotar && !confirmando && botones.length > 0 && (
        <div className="alq-det__acciones">
          {botones.map((accion, i) => (
            <button
              key={accion}
              type="button"
              className={i === 0 ? 'btn btn--grow btn--primary' : 'btn btn--grow'}
              onClick={() => onOpenAction(accion)}
              disabled={envio.enviando}
            >
              {ACCIONES[accion].boton}
            </button>
          ))}
        </div>
      )}

      {puedeVotar && confirmando && (
        <div className="alq-det__confirma">
          <p className="hint alq-det__bloque">{ACCIONES[confirmando].aviso(solicitud)}</p>
          <div className="alq-det__acciones">
            <button type="button" className="btn btn--grow" onClick={onCancelAction} disabled={envio.enviando}>
              Volver
            </button>
            <button
              type="button"
              className="btn btn--grow btn--primary"
              onClick={() => onConfirmAction(confirmando)}
              disabled={envio.enviando}
            >
              {ACCIONES[confirmando].confirmar}
            </button>
          </div>
        </div>
      )}

      {!puedeVotar && pendiente && (
        <p className="hint alq-det__bloque">No encontramos tu sesión. Volvé a entrar para poder votar.</p>
      )}

      {puedeVotar && mostrarVotar && (
        <div className="alq-det__acciones">
          <button
            type="button"
            className="btn btn--grow btn--primary"
            onClick={onApprove}
            disabled={envio.enviando}
          >
            Aprobar
          </button>
          <button type="button" className="btn btn--grow" onClick={onOpenReject} disabled={envio.enviando}>
            Rechazar
          </button>
        </div>
      )}

      {puedeVotar && mostrarMiVoto && (
        <div className="alq-mivoto alq-mivoto--det">
          <span>Tu voto: {VOTO_TEXTO[vote]}</span>
          <button type="button" className="btn btn--link" onClick={onChangeVote}>
            Cambiar voto
          </button>
        </div>
      )}

      {puedeVotar && rechazando && (
        <div className="alq-det__confirma">
          <textarea
            className="ta alq-det__motivo"
            placeholder="Motivo del rechazo (opcional)"
            aria-label="Motivo del rechazo (opcional)"
            maxLength={500}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            aria-invalid={envio.error ? true : undefined}
            aria-describedby={envio.error ? idError : undefined}
          />
          <div className="alq-det__acciones">
            <button type="button" className="btn btn--grow" onClick={onCancelReject} disabled={envio.enviando}>
              Volver
            </button>
            <button
              type="button"
              className="btn btn--grow btn--primary"
              onClick={() => onSubmitReject(motivo)}
              disabled={envio.enviando}
            >
              Confirmar rechazo
            </button>
          </div>
        </div>
      )}

      {envio.error && (
        <p id={idError} className="alq-err" role="alert">
          {envio.error}
        </p>
      )}
    </aside>
  )
}

export default RentalRequestDetail
