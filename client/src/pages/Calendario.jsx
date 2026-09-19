import { useEffect, useState } from 'react'
import { createReservation, fetchReservations } from '../lib/api'
import { ASSET_ID } from '../lib/currentAsset'
import { USER_ID } from '../lib/currentUser'
import {
  colorDeIntegrante,
  diasDelMes,
  estadoDelDia,
  mesAnterior,
  mesSiguiente,
  nombreMes,
} from '../lib/calendar'
import './Calendario.css'

const HOY = new Date()

const ETIQUETA_ESTADO = {
  libre: 'Libre',
  reservado: 'Reservado',
  alquilado: 'Alquilado',
  rechazado: 'Rechazado',
}

function mesParam(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`
}

function Calendario() {
  const [year, setYear] = useState(HOY.getUTCFullYear())
  const [month, setMonth] = useState(HOY.getUTCMonth() + 1)
  const [reservas, setReservas] = useState([])
  const [estadoCarga, setEstadoCarga] = useState('loading') // loading | ok | error
  // Se incrementa despues de crear una solicitud, para forzar el refetch
  // del mes y que el dia recien pedido se vea "pendiente" en la grilla.
  const [refreshKey, setRefreshKey] = useState(0)

  // Layout: el formulario vive en la columna lateral, oculto hasta que se
  // toca "Reservar" (igual que el prototipo).
  const [formAbierto, setFormAbierto] = useState(false)
  const [formInicio, setFormInicio] = useState('')
  const [formFin, setFormFin] = useState('')
  const [formError, setFormError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    let vivo = true

    fetchReservations(ASSET_ID, mesParam(year, month), { signal: controller.signal })
      .then((reservations) => {
        if (vivo) {
          setReservas(reservations)
          setEstadoCarga('ok')
        }
      })
      .catch((err) => {
        if (vivo && err.name !== 'AbortError') setEstadoCarga('error')
      })

    return () => {
      vivo = false
      controller.abort()
    }
  }, [year, month, refreshKey])

  // Historia "Solicitar turno de uso propio". Las validaciones de fechas
  // (reglas 1-3) las hace el backend; aca solo mostramos el error que
  // devuelva.
  const handleSolicitar = async (e) => {
    e.preventDefault()
    setFormError(null)
    setEnviando(true)
    try {
      await createReservation({
        assetId: ASSET_ID,
        userId: USER_ID,
        startDate: formInicio,
        endDate: formFin,
      })
      setFormInicio('')
      setFormFin('')
      setFormAbierto(false)
      setRefreshKey((k) => k + 1)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  const cancelarSolicitud = () => {
    setFormAbierto(false)
    setFormError(null)
    setFormInicio('')
    setFormFin('')
  }

  const irMesAnterior = () => {
    const { year: y, month: m } = mesAnterior(year, month)
    setEstadoCarga('loading')
    setYear(y)
    setMonth(m)
  }

  const irMesSiguiente = () => {
    const { year: y, month: m } = mesSiguiente(year, month)
    setEstadoCarga('loading')
    setYear(y)
    setMonth(m)
  }

  const dias = diasDelMes(year, month)

  return (
    <div className="calendario-layout">
      <section className="calendario">
        <header className="calendario-header">
          <button type="button" onClick={irMesAnterior} aria-label="Mes anterior">
            ‹
          </button>
          <h1 className="calendario-titulo">{nombreMes(year, month)}</h1>
          <button type="button" onClick={irMesSiguiente} aria-label="Mes siguiente">
            ›
          </button>
        </header>

        {estadoCarga === 'error' && (
          <p className="calendario-error">No se pudo cargar el calendario.</p>
        )}

        <div className="calendario-grilla" aria-busy={estadoCarga === 'loading'}>
          {dias.map((dia) => {
            const info = estadoDelDia(dia, reservas)
            const estiloDia =
              info.estado === 'reservado'
                ? { '--color-dia': colorDeIntegrante(info.userId) }
                : undefined

            return (
              <div
                key={dia.toISOString()}
                className={`calendario-dia calendario-dia--${info.estado}`}
                style={estiloDia}
                title={ETIQUETA_ESTADO[info.estado]}
              >
                <span className="calendario-dia-numero">{dia.getUTCDate()}</span>
              </div>
            )
          })}
        </div>
      </section>

      <aside className="calendario-panel">
        {!formAbierto && (
          <button type="button" className="calendario-btn-reservar" onClick={() => setFormAbierto(true)}>
            Reservar
          </button>
        )}

        {formAbierto && (
          <form className="calendario-solicitud" onSubmit={handleSolicitar}>
            <h2 className="calendario-solicitud-titulo">Solicitar turno de uso propio</h2>
            <div className="calendario-solicitud-fechas">
              <label>
                Desde
                <input
                  type="date"
                  value={formInicio}
                  onChange={(e) => setFormInicio(e.target.value)}
                  required
                />
              </label>
              <label>
                Hasta
                <input
                  type="date"
                  value={formFin}
                  onChange={(e) => setFormFin(e.target.value)}
                  required
                />
              </label>
            </div>
            <div className="calendario-solicitud-acciones">
              <button type="button" className="calendario-btn-secundario" onClick={cancelarSolicitud}>
                Cancelar
              </button>
              <button type="submit" disabled={enviando}>
                {enviando ? 'Enviando...' : 'Solicitar'}
              </button>
            </div>
            {formError && <p className="calendario-solicitud-error">{formError}</p>}
          </form>
        )}
      </aside>
    </div>
  )
}

export default Calendario
