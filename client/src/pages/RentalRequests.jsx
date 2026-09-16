import { useEffect, useState } from 'react'
import RentalRequestCard from '../components/RentalRequestCard'
import { fetchRentalRequests } from '../services/rentalRequest'
import './RentalRequests.css'

// Alquiler a terceros > Solicitudes: separa las solicitudes del bien en
// pendientes (esperando votos) y resueltas (aprobadas o rechazadas).
function RentalRequests({ assetId }) {
  const [estado, setEstado] = useState('loading')
  const [solicitudes, setSolicitudes] = useState([])
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let vivo = true

    fetchRentalRequests(assetId, { signal: controller.signal })
      .then((data) => {
        if (!vivo) return
        setSolicitudes(data)
        setEstado('ok')
      })
      .catch((err) => {
        if (vivo && err.name !== 'AbortError') setEstado('error')
      })

    return () => {
      vivo = false
      controller.abort()
    }
  }, [assetId, intento])

  const reintentar = () => {
    setEstado('loading')
    setIntento((n) => n + 1)
  }

  if (estado === 'loading') {
    return <p className="rental-requests__info">Cargando solicitudes…</p>
  }

  if (estado === 'error') {
    return (
      <div className="rental-requests__info">
        <p>No se pudieron cargar las solicitudes.</p>
        <button type="button" onClick={reintentar}>
          Reintentar
        </button>
      </div>
    )
  }

  if (solicitudes.length === 0) {
    return (
      <p className="rental-requests__info">
        Todavía no hay solicitudes de alquiler para este bien.
      </p>
    )
  }

  const pendientes = solicitudes.filter((s) => s.status === 'PENDING')
  const resueltas = solicitudes.filter((s) => s.status !== 'PENDING')

  return (
    <section className="rental-requests">
      <Seccion titulo="Pendientes" solicitudes={pendientes} />
      <Seccion titulo="Resueltas" solicitudes={resueltas} />
    </section>
  )
}

function Seccion({ titulo, solicitudes }) {
  if (solicitudes.length === 0) return null

  return (
    <div className="rental-requests__section">
      <h2>{titulo}</h2>
      <ul className="rental-requests__list">
        {solicitudes.map((s) => (
          <RentalRequestCard key={s.id} solicitud={s} />
        ))}
      </ul>
    </div>
  )
}

export default RentalRequests
