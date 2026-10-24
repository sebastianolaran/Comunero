import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import Pagination from '../components/Pagination'
import { Cargando, ErrorCarga, Vacio } from '../components/ui/Estado'
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
    return <Vacio panel titulo="No encontramos tu sesión.">Volvé a entrar.</Vacio>
  }

  if (carga.estado === 'loading') {
    return (
      <Cargando>Cargando historial de alquileres…</Cargando>
    )
  }

  if (carga.estado === 'error') {
    return (
      <ErrorCarga titulo="No se pudo cargar el historial de alquileres." onReintentar={reintentar} />
    )
  }

  if (carga.alquileres.length === 0) {
    return <Vacio panel titulo="Todavía no hay alquileres terminados." />
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
