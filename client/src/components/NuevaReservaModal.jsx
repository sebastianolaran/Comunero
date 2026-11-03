import { useEffect, useId, useRef, useState } from 'react'
import FieldError from './ui/FieldError'
import Modal, { ModalAcciones } from './ui/Modal'
import { createReservation } from '../lib/api'
import { turnoDemasiadoLargo } from '../lib/calendar'
import { hoyLocal } from '../lib/rentalRequests'
import { fetchSettings } from '../services/settings'

// Pedir un turno de uso propio. El solapamiento y el máximo de días los
// valida el server igual; el máximo se chequea acá para avisar antes.
function NuevaReservaModal({ assetId, userId, onCreada, onClose }) {
  const cancelar = useRef(null)
  const id = useId()
  const [form, setForm] = useState(() => ({ inicio: hoyLocal(), fin: hoyLocal() }))
  const [maximoDias, setMaximoDias] = useState(null)
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetchSettings(assetId, userId, { signal: controller.signal })
      .then((settings) => setMaximoDias(settings.maxConsecutiveDays))
      .catch(() => setMaximoDias(null))
    return () => controller.abort()
  }, [assetId, userId])

  const setCampo = (campo) => (e) => {
    const valor = e.target.value
    // Elegir un inicio después del fin corre el fin: el rango nunca queda invertido.
    setForm((f) => (campo === 'inicio' && valor > f.fin ? { inicio: valor, fin: valor } : { ...f, [campo]: valor }))
  }

  const enviar = async (e) => {
    e.preventDefault()
    const demasiadoLargo = turnoDemasiadoLargo(form.inicio, form.fin, maximoDias)
    if (demasiadoLargo) return setError(demasiadoLargo)
    setError(null)
    setEnviando(true)
    try {
      await createReservation({ assetId, userId, startDate: form.inicio, endDate: form.fin })
      onCreada()
    } catch (err) {
      setError(err.message)
      setEnviando(false)
    }
  }

  return (
    <Modal titulo="Nueva reserva" describedBy={`${id}-texto`} foco={cancelar} onClose={onClose}>
      <form onSubmit={enviar}>
        <p id={`${id}-texto`} className="hint">
          Turno de uso propio: lo votan los demás copropietarios. Para alquilar a un tercero está la sección Alquileres.
          {maximoDias != null && ` Hasta ${maximoDias === 1 ? '1 día' : `${maximoDias} días seguidos`}.`}
        </p>
        <div className="res-modal__fechas">
          <label className="lbl">
            Desde
            <input className="in" type="date" min={hoyLocal()} value={form.inicio} onChange={setCampo('inicio')} required />
          </label>
          <label className="lbl">
            Hasta
            <input className="in" type="date" min={form.inicio} value={form.fin} onChange={setCampo('fin')} required />
          </label>
        </div>
        <FieldError>{error}</FieldError>
        <ModalAcciones>
          <button ref={cancelar} type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn--primary" disabled={enviando}>
            {enviando ? 'Enviando…' : 'Confirmar reserva'}
          </button>
        </ModalAcciones>
      </form>
    </Modal>
  )
}

export default NuevaReservaModal
