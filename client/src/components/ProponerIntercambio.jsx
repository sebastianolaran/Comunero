import { useEffect, useId, useRef, useState } from 'react'
import FieldError from './ui/FieldError'
import Modal, { ModalAcciones } from './ui/Modal'
import { Cargando } from './ui/Estado'
import { textoTurno } from '../lib/swaps'
import { fetchSwapOptions, proposeSwap } from '../services/reservationSwap'

// Elegir cuál de los turnos propios se ofrece a cambio del turno pedido.
function ProponerIntercambio({ pedido, userId, onPropuesto, onClose }) {
  const cancelar = useRef(null)
  const id = useId()
  const [opciones, setOpciones] = useState(null)
  const [elegido, setElegido] = useState(null)
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetchSwapOptions(userId, pedido.id, { signal: controller.signal })
      .then((turnos) => {
        setOpciones(turnos)
        setElegido(turnos[0]?.id ?? null)
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setOpciones([])
          setError(err.message)
        }
      })
    return () => controller.abort()
  }, [userId, pedido.id])

  const proponer = async () => {
    if (!elegido || enviando) return
    setEnviando(true)
    setError(null)
    try {
      await proposeSwap({ userId, offeredReservationId: elegido, requestedReservationId: pedido.id })
      onPropuesto()
    } catch (err) {
      setError(err.message)
      setEnviando(false)
    }
  }

  return (
    <Modal titulo="Proponer intercambio" describedBy={`${id}-texto`} foco={cancelar} onClose={onClose}>
      <div id={`${id}-texto`} className="modal__texto">
        <p>
          Turno de {pedido.user?.name ?? 'otro integrante'}: {textoTurno(pedido)}. Se ofrece a cambio un turno propio con la
          misma cantidad de días; si lo acepta, cada turno pasa a nombre del otro.
        </p>
      </div>
      {opciones === null && <Cargando panel={false}>Buscando turnos propios…</Cargando>}
      {opciones?.length === 0 && !error && (
        <p className="hint">No hay turnos propios aprobados y futuros con la misma cantidad de días para ofrecer.</p>
      )}
      {opciones?.length > 0 && (
        <fieldset className="cal-swap__opciones">
          <legend className="lbl">Turno propio a ofrecer</legend>
          {opciones.map((turno) => (
            <label key={turno.id} className="chk">
              <input
                type="radio"
                name={`${id}-turno`}
                checked={elegido === turno.id}
                onChange={() => setElegido(turno.id)}
              />
              {textoTurno(turno)}
            </label>
          ))}
        </fieldset>
      )}
      <FieldError>{error}</FieldError>
      <ModalAcciones>
        <button ref={cancelar} type="button" className="btn" onClick={onClose}>
          Cancelar
        </button>
        <button type="button" className="btn btn--primary" onClick={proponer} disabled={!elegido || enviando}>
          {enviando ? 'Enviando…' : 'Proponer intercambio'}
        </button>
      </ModalAcciones>
    </Modal>
  )
}

export default ProponerIntercambio
