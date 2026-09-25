import { useId, useState } from 'react'
import {
  daysLabel,
  ESTADOS,
  etiquetaPago,
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
      <aside className="detalle" aria-label="Detalle de la solicitud">
        <p className="detalle-vacio">
          Elegí una solicitud para ver el detalle completo, la votación y las objeciones.
        </p>
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
  const pago = etiquetaPago(solicitud)
  const disponibles = {
    pagar: puedeMarcarPago(solicitud),
    cancelar: puedeCancelar(solicitud),
  }
  const confirmando = disponibles[modo] ? modo : null
  const botones = Object.keys(ACCIONES).filter((accion) => disponibles[accion])

  return (
    <aside className="detalle" aria-label={`Detalle de la solicitud de ${nombre}`}>
      <h2 className="detalle-nombre">{nombre}</h2>
      {renterPhone && <p className="detalle-contacto">{formatPhone(renterPhone)}</p>}
      <div className="detalle-badges">
        <span className="solicitud-estado">{ESTADOS[status] ?? status}</span>
        {pago && <span className={`solicitud-estado is-pago${solicitud.paid ? ' is-pagado' : ''}`}>{pago}</span>}
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

      {(rejections.length > 0 || rejectionReason) && (
        <ul className="detalle-objeciones">
          {rejectionReason && <li>{rejectionReason}</li>}
          {rejections.map((r, i) => (
            <li key={r.name ?? i}>
              Objeción de {r.name}: {motivoRechazo(r.reason)}
            </li>
          ))}
        </ul>
      )}

      {solicitud.blockedByOverlap && (
        <p className="detalle-nota">
          Se pisa con una reserva aprobada: no se puede votar mientras esa reserva siga en pie.
        </p>
      )}

      {status === 'APPROVED' && (
        <p className="detalle-nota">Aprobada por unanimidad: ya quedó reservada en el calendario.</p>
      )}

      {puedeVotar && !confirmando && botones.length > 0 && (
        <div className="detalle-acciones">
          {botones.map((accion, i) => (
            <button
              key={accion}
              type="button"
              className={i === 0 ? 'detalle-boton is-primario' : 'detalle-boton'}
              onClick={() => onOpenAction(accion)}
              disabled={envio.enviando}
            >
              {ACCIONES[accion].boton}
            </button>
          ))}
        </div>
      )}

      {puedeVotar && confirmando && (
        <div className="detalle-rechazo">
          <p className="detalle-nota">{ACCIONES[confirmando].aviso(solicitud)}</p>
          <div className="detalle-acciones">
            <button type="button" className="detalle-boton" onClick={onCancelAction} disabled={envio.enviando}>
              Volver
            </button>
            <button
              type="button"
              className="detalle-boton is-confirmar"
              onClick={() => onConfirmAction(confirmando)}
              disabled={envio.enviando}
            >
              {ACCIONES[confirmando].confirmar}
            </button>
          </div>
        </div>
      )}

      {!puedeVotar && pendiente && (
        <p className="detalle-nota">No encontramos tu sesión. Volvé a entrar para poder votar.</p>
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
            placeholder="Motivo del rechazo (opcional)"
            aria-label="Motivo del rechazo (opcional)"
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
