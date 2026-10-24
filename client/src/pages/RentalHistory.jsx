import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import PagoTag from '../components/PagoTag'
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
    return <Vacio panel titulo="La sesión no está activa.">Ingresar de nuevo para continuar.</Vacio>
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
    <div className="card card--flush tabla-wrap">
      <table className="tabla">
        <caption className="solo-lector">Historial de alquileres</caption>
        <thead>
          <tr className="tbl__h">
            <th scope="col">Inquilino</th>
            <th scope="col">Fechas</th>
            <th scope="col">Teléfono</th>
            <th scope="col" className="tabla__num">
              Monto
            </th>
            <th scope="col">Pago</th>
          </tr>
        </thead>
        <tbody>
          {paginacion.elementos.map((alquiler) => {
            const seleccionado = alquiler.id === reservationId
            return (
              <tr
                key={alquiler.id}
                id={`alquiler-historico-${alquiler.id}`}
                className={seleccionado ? 'tbl__r tabla__r--on' : 'tbl__r'}
                aria-current={seleccionado ? 'true' : undefined}
              >
                <th scope="row" className="tabla__nombre">
                  {alquiler.renter?.name ?? 'Inquilino no disponible'}
                </th>
                <td>{formatRange(alquiler.startDate, alquiler.endDate)}</td>
                <td className="tabla__suave">{alquiler.renter?.phone ? formatPhone(alquiler.renter.phone) : '—'}</td>
                <td className="tabla__num money">{formatMoney(alquiler.amount) ?? '—'}</td>
                <td>
                  <PagoTag solicitud={{ status: 'APPROVED', paid: Boolean(alquiler.paidAt) }} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <Pagination {...paginacion} />
    </div>
  )
}

export default RentalHistory
