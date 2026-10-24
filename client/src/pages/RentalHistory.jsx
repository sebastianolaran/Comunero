import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import Pagination from '../components/Pagination'
import { formatMoney, formatPhone, formatRange } from '../lib/rentalRequests'
import { assetIdActual } from '../lib/currentAsset'
import { fetchRentalHistory } from '../lib/api'
import { usePaginacion } from '../lib/pagination'

function RentalHistory({ assetId = assetIdActual() }) {
  const location = useLocation()
  const reservationId = location.state?.reservationId
  const [carga, setCarga] = useState({ estado: 'loading', alquileres: [] })
  const [intento, setIntento] = useState(0)
  const ordenados = [...carga.alquileres].sort((a, b) => {
    if (a.id === reservationId) return -1
    if (b.id === reservationId) return 1
    return 0
  })
  const paginacion = usePaginacion(ordenados)

  useEffect(() => {
    if (!assetId) return
    const controller = new AbortController()
    fetchRentalHistory(assetId, { signal: controller.signal })
      .then((alquileres) => setCarga({ estado: 'ok', alquileres }))
      .catch((err) => {
        if (err.name !== 'AbortError') setCarga({ estado: 'error', alquileres: [] })
      })
    return () => controller.abort()
  }, [assetId, intento])

  useEffect(() => {
    if (carga.estado !== 'ok' || !reservationId) return
    document.getElementById(`alquiler-historico-${reservationId}`)?.scrollIntoView({
      block: 'center',
      behavior: 'smooth',
    })
  }, [carga.estado, reservationId])

  const reintentar = () => {
    setCarga({ estado: 'loading', alquileres: [] })
    setIntento((n) => n + 1)
  }

  if (!assetId) {
    return <p className="panel empty">No encontramos tu sesión. Volvé a entrar.</p>
  }

  if (carga.estado === 'loading') {
    return (
      <p className="panel empty" role="status">
        Cargando historial de alquileres…
      </p>
    )
  }

  if (carga.estado === 'error') {
    return (
      <div className="panel empty empty--rail" role="alert">
        <p>No se pudo cargar el historial de alquileres.</p>
        <p className="hint">Si el backend estuvo inactivo, el primer request puede tardar ~30–50 s.</p>
        <button type="button" className="btn btn--sm" onClick={reintentar}>
          Reintentar
        </button>
      </div>
    )
  }

  if (carga.alquileres.length === 0) {
    return <p className="empty">Todavía no hay alquileres terminados.</p>
  }

  return (
    <div className="alq-historial">
      <h2 className="solo-lector">Historial de alquileres</h2>
      <ul className="alq-lista alq-lista--resueltas">
        {paginacion.elementos.map((alquiler) => {
          const seleccionado = alquiler.id === reservationId
          const monto = formatMoney(alquiler.amount)
          return (
            <li
              key={alquiler.id}
              id={`alquiler-historico-${alquiler.id}`}
              className={seleccionado ? 'card card--pad alq-hist__item alq-hist__item--seleccionado' : 'card card--pad alq-hist__item'}
              aria-current={seleccionado ? 'true' : undefined}
            >
              <div className="alq-hist__head">
                <div>
                  <h3 className="alq-rq__name">{alquiler.renter?.name ?? 'Inquilino no disponible'}</h3>
                  <p className="meta">{formatRange(alquiler.startDate, alquiler.endDate)}</p>
                </div>
                <span className={alquiler.paidAt ? 'tag tag--solid' : 'tag tag--dash'}>
                  {alquiler.paidAt ? 'Pago registrado' : 'Pendiente de pago'}
                </span>
              </div>
              <div className="alq-hist__meta">
                {alquiler.renter?.phone && <span>{formatPhone(alquiler.renter.phone)}</span>}
                {monto && <span className="money">{monto}</span>}
              </div>
            </li>
          )
        })}
      </ul>
      <Pagination {...paginacion} />
    </div>
  )
}

export default RentalHistory
