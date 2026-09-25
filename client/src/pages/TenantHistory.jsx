import { useEffect, useRef, useState } from 'react'
import TenantDetail from '../components/TenantDetail'
import { assetIdActual } from '../lib/currentAsset'
import { userIdActual } from '../lib/currentUser'
import { formatPhone } from '../lib/rentalRequests'
import { alquileresLabel, clasificacion, conClasificacion, mensajeVacio } from '../lib/tenants'
import { fetchTenants } from '../services/tenant'
import './TenantHistory.css'

const DEBOUNCE_MS = 250

function TenantHistory({ assetId = assetIdActual(), userId = userIdActual() }) {
  const [busqueda, setBusqueda] = useState('')
  const [carga, setCarga] = useState({ estado: 'loading', inquilinos: [], busqueda: '' })
  const [intento, setIntento] = useState(0)
  const escribiendo = useRef(false)
  const [seleccion, setSeleccion] = useState(null)

  useEffect(() => {
    if (!assetId) return
    const controller = new AbortController()
    // La primera carga y los reintentos salen enseguida: solo se demora mientras se escribe.
    const demora = escribiendo.current ? DEBOUNCE_MS : 0
    escribiendo.current = false
    const timer = setTimeout(() => {
      fetchTenants(assetId, { q: busqueda, signal: controller.signal })
        .then((inquilinos) => setCarga({ estado: 'ok', inquilinos, busqueda }))
        .catch((err) => {
          if (err.name !== 'AbortError') setCarga({ estado: 'error', inquilinos: [], busqueda })
        })
    }, demora)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [assetId, busqueda, intento])

  // La fila de la lista refleja la clasificación nueva sin volver a pedirla.
  const actualizarClasificacion = (id, rating) => {
    setCarga((prev) => ({ ...prev, inquilinos: conClasificacion(prev.inquilinos, id, rating) }))
  }

  const reintentar = () => {
    setCarga({ estado: 'loading', inquilinos: [], busqueda })
    setIntento((n) => n + 1)
  }

  if (!assetId) {
    return (
      <p className="aviso">No encontramos tu sesión. Volvé a entrar.</p>
    )
  }

  return (
    <div className="solicitudes-layout">
      <div className="inquilinos">
        <input
          type="search"
          className="inquilinos-buscador"
          placeholder="Buscar por nombre o teléfono"
          aria-label="Buscar inquilinos por nombre o teléfono"
          value={busqueda}
          onChange={(e) => {
            escribiendo.current = true
            setBusqueda(e.target.value)
          }}
        />

        {carga.estado === 'loading' && (
          <p className="aviso" role="status">
            Cargando inquilinos…
          </p>
        )}

        {carga.estado === 'error' && (
          <div className="aviso" role="alert">
            <p>No se pudo cargar el historial de inquilinos.</p>
            <p className="aviso-hint">
              Si el backend estuvo inactivo, el primer request puede tardar ~30–50 s.
            </p>
            <button type="button" className="aviso-reintentar" onClick={reintentar}>
              Reintentar
            </button>
          </div>
        )}

        {carga.estado === 'ok' && carga.inquilinos.length === 0 && (
          <p className="aviso" role="status">
            {mensajeVacio(carga.busqueda)}
          </p>
        )}

        {carga.estado === 'ok' && carga.inquilinos.length > 0 && (
          <ul className="inquilinos-lista">
            {carga.inquilinos.map((inquilino) => {
              const { label, variante } = clasificacion(inquilino.rating)
              const elegido = inquilino.id === seleccion
              return (
                <li
                  key={inquilino.id}
                  className={elegido ? 'inquilino is-seleccionado' : 'inquilino'}
                  onClick={() => setSeleccion(inquilino.id)}
                >
                  <div className="inquilino-cabecera">
                    <h3 className="inquilino-nombre">
                      {/* La fila entera selecciona con el mouse; con teclado se entra por el nombre. */}
                      <button
                        type="button"
                        className="inquilino-abrir"
                        aria-current={elegido || undefined}
                        onClick={(e) => {
                          e.stopPropagation()
                          setSeleccion(inquilino.id)
                        }}
                      >
                        {inquilino.name}
                      </button>
                    </h3>
                    <span className={`inquilino-clasificacion is-${variante}`}>{label}</span>
                  </div>
                  <p className="inquilino-meta">
                    {formatPhone(inquilino.phone)} · {alquileresLabel(inquilino.finishedStays)}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {seleccion ? (
        <TenantDetail
          key={seleccion}
          tenantId={seleccion}
          assetId={assetId}
          userId={userId}
          onRated={actualizarClasificacion}
        />
      ) : (
        <aside className="detalle" aria-label="Detalle del inquilino">
          <p className="detalle-vacio">Elegí un inquilino para ver su historial y sus observaciones.</p>
        </aside>
      )}
    </div>
  )
}

export default TenantHistory
