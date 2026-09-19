import { useEffect, useState } from 'react'
import { fetchReservations } from '../lib/api'
import { ASSET_ID } from '../lib/currentAsset'
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
  }, [year, month])

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
  )
}

export default Calendario
