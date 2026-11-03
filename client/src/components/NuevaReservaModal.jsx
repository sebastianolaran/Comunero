import { useEffect, useId, useRef, useState } from 'react'
import CalendarioDisponibilidad from './CalendarioDisponibilidad'
import FieldError from './ui/FieldError'
import Modal, { ModalAcciones } from './ui/Modal'
import { createReservation, fetchOccupiedDays } from '../lib/api'
import { turnoDemasiadoLargo } from '../lib/calendar'
import { rangoOcupado } from '../lib/listing'
import { hoyLocal } from '../lib/rentalRequests'
import { fetchSettings } from '../services/settings'

// Pedir un turno de uso propio. El mini calendario muestra qué días ya están
// tomados (aprobados o pendientes) para elegir sin probar a ciegas. El
// solapamiento y el máximo de días los valida el server igual.
function NuevaReservaModal({ assetId, userId, onCreada, onClose }) {
  const cancelar = useRef(null)
  const id = useId()
  const [form, setForm] = useState({ inicio: '', fin: '' })
  const [maximoDias, setMaximoDias] = useState(null)
  // null mientras carga; si falla, el formulario sigue andando sin calendario.
  const [ocupados, setOcupados] = useState(null)
  const [errorOcupados, setErrorOcupados] = useState(false)
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetchSettings(assetId, userId, { signal: controller.signal })
      .then((settings) => setMaximoDias(settings.maxConsecutiveDays))
      .catch(() => setMaximoDias(null))
    fetchOccupiedDays(assetId, { signal: controller.signal })
      .then(setOcupados)
      .catch((err) => {
        if (err.name !== 'AbortError') setErrorOcupados(true)
      })
    return () => controller.abort()
  }, [assetId, userId])

  const elegirEnCalendario = ({ startDate, endDate }) => {
    setError(null)
    setForm({ inicio: startDate, fin: endDate })
  }

  const setCampo = (campo) => (e) => {
    const valor = e.target.value
    // Elegir un inicio después del fin corre el fin: el rango nunca queda invertido.
    setForm((f) => (campo === 'inicio' && valor > f.fin ? { inicio: valor, fin: valor } : { ...f, [campo]: valor }))
  }

  const enviar = async (e) => {
    e.preventDefault()
    const demasiadoLargo = turnoDemasiadoLargo(form.inicio, form.fin, maximoDias)
    if (demasiadoLargo) return setError(demasiadoLargo)
    if (ocupados && rangoOcupado(form.inicio, form.fin, ocupados)) {
      return setError('El rango incluye días ya ocupados por otra reserva o pedido pendiente.')
    }
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
    <Modal titulo="Nueva reserva" ancho="calendario" describedBy={`${id}-texto`} foco={cancelar} onClose={onClose}>
      <form onSubmit={enviar}>
        <p id={`${id}-texto`} className="hint">
          Turno de uso propio: lo votan los demás copropietarios. Para alquilar a un tercero está la sección Alquileres.
          {maximoDias != null && ` Hasta ${maximoDias === 1 ? '1 día' : `${maximoDias} días seguidos`}.`}
        </p>
        {ocupados === null && !errorOcupados && <p className="hint res-modal__cal">Cargando los días ocupados…</p>}
        {errorOcupados && (
          <p className="hint res-modal__cal">No se pudieron cargar los días ocupados: las fechas se pueden cargar igual a mano.</p>
        )}
        {ocupados && (
          <div className="res-modal__cal">
            <CalendarioDisponibilidad
              modo="dias"
              ocupados={ocupados}
              hoy={hoyLocal()}
              desde={form.inicio}
              hasta={form.fin}
              onElegir={elegirEnCalendario}
            />
          </div>
        )}
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
