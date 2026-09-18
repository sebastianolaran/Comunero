import { useEffect, useId, useState } from 'react'
import RentalRequestCard from '../components/RentalRequestCard'
import { agrupar } from '../lib/rentalRequests'
import { fetchRentalRequests } from '../services/rentalRequest'

// TODO: usar el bien del usuario logueado cuando exista el login.
const ASSET_ID = import.meta.env.VITE_DEMO_ASSET_ID

function RentalRequests({ assetId = ASSET_ID }) {
  const [carga, setCarga] = useState({ estado: 'loading', solicitudes: [] })
  const [intento, setIntento] = useState(0)
  const idPendientes = useId()
  const idResueltas = useId()

  useEffect(() => {
    if (!assetId) return
    const controller = new AbortController()
    let vivo = true

    fetchRentalRequests(assetId, { signal: controller.signal })
      .then((solicitudes) => {
        if (vivo) setCarga({ estado: 'ok', solicitudes })
      })
      .catch((err) => {
        if (vivo && err.name !== 'AbortError') setCarga({ estado: 'error', solicitudes: [] })
      })

    return () => {
      vivo = false
      controller.abort()
    }
  }, [assetId, intento])

  const reintentar = () => {
    setCarga({ estado: 'loading', solicitudes: [] })
    setIntento((n) => n + 1)
  }

  if (!assetId) {
    return (
      <p className="aviso">
        Falta configurar <code>VITE_DEMO_ASSET_ID</code> en <code>client/.env</code>.
      </p>
    )
  }

  if (carga.estado === 'loading') {
    return (
      <p className="aviso" role="status">
        Cargando solicitudes…
      </p>
    )
  }

  if (carga.estado === 'error') {
    return (
      <div className="aviso" role="alert">
        <p>No se pudieron cargar las solicitudes.</p>
        <p className="aviso-hint">
          Si el backend estuvo inactivo, el primer request puede tardar ~30–50 s.
        </p>
        <button type="button" className="aviso-reintentar" onClick={reintentar}>
          Reintentar
        </button>
      </div>
    )
  }

  if (carga.solicitudes.length === 0) {
    return <p className="aviso">Todavía no hay solicitudes de alquiler para este bien.</p>
  }

  const { pendientes, resueltas } = agrupar(carga.solicitudes)

  return (
    <div className="solicitudes">
      <p className="solicitudes-regla">
        Cada alquiler requiere la aprobación de los {carga.solicitudes[0].coownerCount}{' '}
        copropietarios
      </p>

      <section aria-labelledby={idPendientes}>
        <h2 id={idPendientes} className="solicitudes-grupo">
          Pendientes de aprobación
        </h2>
        {pendientes.length === 0 ? (
          <p className="solicitudes-vacio">No hay solicitudes esperando votación.</p>
        ) : (
          pendientes.map((s) => <RentalRequestCard key={s.id} solicitud={s} />)
        )}
      </section>

      {resueltas.length > 0 && (
        <section aria-labelledby={idResueltas} className="solicitudes-resueltas">
          <h2 id={idResueltas} className="solicitudes-grupo">
            Resueltas
          </h2>
          {resueltas.map((s) => (
            <RentalRequestCard key={s.id} solicitud={s} />
          ))}
        </section>
      )}
    </div>
  )
}

export default RentalRequests
