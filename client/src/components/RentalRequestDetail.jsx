import { useId, useState } from 'react'
import {
  daysLabel,
  formatMoney,
  formatPhone,
  formatRange,
  motivoRechazo,
  personasLabel,
  puedeCancelar,
  puedeEditarMonto,
  puedeMarcarPago,
  puedeVotar as admiteVoto,
  textoEstado,
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
      `Se registra un ingreso de ${formatMoney(s.amount)} a nombre de quien cobró, repartido entre todos. Después no se puede volver a Pendiente.`,
  },
  cancelar: {
    boton: 'Cancelar alquiler',
    confirmar: 'Confirmar cancelación',
    aviso: () => 'Los días quedan libres. Para volver a alquilarlos hay que cargar otra solicitud.',
  },
}

// Acepta "10.000" o "$10.000".
function leerMonto(texto) {
  const limpio = texto.replace(/[\s$.]/g, '')
  if (!/^\d+$/.test(limpio)) return null
  return Number(limpio)
}

// Las que llegan desde la ficha traen el precio por día × días (o nada si no
// había precio): se corrige acá antes de aprobar.
function Monto({ solicitud, editable, onGuardar }) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState('')
  const [estado, setEstado] = useState({ guardando: false, error: null })
  const id = useId()

  if (!editando) {
    return (
      <p className="alq-det__monto">
        {solicitud.amount != null ? formatMoney(solicitud.amount) : <span className="meta">Sin monto</span>}
        {editable && (
          <button
            type="button"
            className="btn btn--link"
            onClick={() => {
              setTexto(solicitud.amount == null ? '' : String(solicitud.amount))
              setEstado({ guardando: false, error: null })
              setEditando(true)
            }}
          >
            {solicitud.amount == null ? 'Cargar monto' : 'Cambiar monto'}
          </button>
        )}
      </p>
    )
  }

  async function guardar() {
    const monto = leerMonto(texto)
    if (monto == null) return setEstado({ guardando: false, error: 'El monto tiene que ser un número entero.' })
    setEstado({ guardando: true, error: null })
    try {
      await onGuardar(monto)
      setEditando(false)
    } catch (err) {
      setEstado({ guardando: false, error: err.message })
    }
  }

  return (
    <div className="alq-det__bloque">
      <label className="lbl" htmlFor={id}>
        Monto total
      </label>
      <input
        id={id}
        className="in in--num"
        inputMode="numeric"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        disabled={estado.guardando}
      />
      {estado.error && (
        <p className="alq-err" role="alert">
          {estado.error}
        </p>
      )}
      <div className="alq-det__acciones">
        <button type="button" className="btn btn--grow" onClick={() => setEditando(false)} disabled={estado.guardando}>
          Volver
        </button>
        <button type="button" className="btn btn--grow btn--primary" onClick={guardar} disabled={estado.guardando}>
          {estado.guardando ? 'Guardando…' : 'Guardar monto'}
        </button>
      </div>
    </div>
  )
}

// modo: 'ver' | 'rechazar' | 'cambiar' | 'pagar' | 'cancelar' (Cambiar voto vuelve a mostrar
// Aprobar/Rechazar; pagar y cancelar muestran su confirmación).
function RentalRequestDetail({
  ref,
  solicitud,
  userId,
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
  onUpdateAmount,
}) {
  const [motivo, setMotivo] = useState('')
  // Quien recibió la plata del alquiler: por defecto, quien marca el pago.
  const [cobradorId, setCobradorId] = useState(userId ?? '')
  const idError = useId()
  const idCobrador = useId()

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
      {(renterPhone || solicitud.renterEmail) && (
        <p className="meta alq-det__contact">
          {[formatPhone(renterPhone), solicitud.renterEmail].filter(Boolean).join(' · ')}
        </p>
      )}
      <div className="alq-badges alq-det__badges">
        {solicitud.fromListing && <span className="badge badge--dash">Desde la ficha pública</span>}
        <PagoTag solicitud={solicitud} />
        <span className="badge">{textoEstado(solicitud)}</span>
      </div>
      <p className="alq-det__fechas">
        {[formatRange(startDate, endDate), daysLabel(startDate, endDate), personasLabel(solicitud.guests)]
          .filter(Boolean)
          .join(' · ')}
      </p>
      <Monto
        solicitud={solicitud}
        editable={puedeVotar && puedeEditarMonto(solicitud, userId) && Boolean(onUpdateAmount)}
        onGuardar={onUpdateAmount}
      />
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
          {confirmando === 'pagar' && (
            <div className="alq-det__bloque">
              <label className="lbl" htmlFor={idCobrador}>
                ¿Quién cobró?
              </label>
              <select
                id={idCobrador}
                className="sel"
                value={cobradorId}
                onChange={(e) => setCobradorId(e.target.value)}
                disabled={envio.enviando}
              >
                {solicitud.votes.map((c) => (
                  <option key={c.userId} value={c.userId}>
                    {c.userId === userId ? `${c.name} (vos)` : c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <p className="hint alq-det__bloque">{ACCIONES[confirmando].aviso(solicitud)}</p>
          <div className="alq-det__acciones">
            <button type="button" className="btn btn--grow" onClick={onCancelAction} disabled={envio.enviando}>
              Volver
            </button>
            <button
              type="button"
              className="btn btn--grow btn--primary"
              onClick={() =>
                onConfirmAction(confirmando, confirmando === 'pagar' ? { collectedById: cobradorId || undefined } : {})
              }
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
