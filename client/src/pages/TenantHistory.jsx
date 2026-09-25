import { useEffect, useRef, useState } from 'react'
import TenantDetail from '../components/TenantDetail'
import { assetIdActual } from '../lib/currentAsset'
import { userIdActual } from '../lib/currentUser'
import { formatPhone } from '../lib/rentalRequests'
import { alquileresLabel, clasificacion, conClasificacion, mensajeVacio } from '../lib/tenants'
import { fetchTenants } from '../services/tenant'
import { useDetalleEnMobile } from '../lib/useDetalleEnMobile'

const DEBOUNCE_MS = 250

const CLASE_TAG = { solida: 'tag tag--solid', normal: 'tag', punteada: 'tag tag--dash' }

function TenantHistory({ assetId = assetIdActual(), userId = userIdActual() }) {
  const [busqueda, setBusqueda] = useState('')
  const [carga, setCarga] = useState({ estado: 'loading', inquilinos: [], busqueda: '' })
  const [intento, setIntento] = useState(0)
  const escribiendo = useRef(false)
  const [seleccion, setSeleccion] = useState(null)
  const [detalleRef, mostrarDetalle] = useDetalleEnMobile()

  const elegir = (id) => {
    setSeleccion(id)
    mostrarDetalle()
  }

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
    return <p className="panel empty">No encontramos tu sesión. Volvé a entrar.</p>
  }

  return (
    <div className="split alq-split">
      <div className="split__main alq-inq">
        <input
          type="search"
          name="q"
          className="in"
          placeholder="Buscar por nombre o teléfono"
          aria-label="Buscar inquilinos por nombre o teléfono"
          value={busqueda}
          onChange={(e) => {
            escribiendo.current = true
            setBusqueda(e.target.value)
          }}
        />

        {carga.estado === 'loading' && (
          <p className="panel empty" role="status">
            Cargando inquilinos…
          </p>
        )}

        {carga.estado === 'error' && (
          <div className="panel empty empty--rail" role="alert">
            <p>No se pudo cargar el historial de inquilinos.</p>
            <p className="hint">Si el backend estuvo inactivo, el primer request puede tardar ~30–50 s.</p>
            <button type="button" className="btn btn--sm" onClick={reintentar}>
              Reintentar
            </button>
          </div>
        )}

        {carga.estado === 'ok' && carga.inquilinos.length === 0 && (
          <p className="empty" role="status">
            {mensajeVacio(carga.busqueda)}
          </p>
        )}

        {carga.estado === 'ok' && carga.inquilinos.length > 0 && (
          <>
            <h2 className="solo-lector">Inquilinos</h2>
            <ul className="alq-lista alq-lista--resueltas">
              {carga.inquilinos.map((inquilino) => {
                const { label, variante } = clasificacion(inquilino.rating)
                const elegido = inquilino.id === seleccion
                return (
                  <li
                    key={inquilino.id}
                    className={elegido ? 'card card--pad pick pick--on' : 'card card--pad pick'}
                    onClick={() => elegir(inquilino.id)}
                  >
                    <div className="alq-rq__head">
                      <h3 className="alq-rq__name">
                        {/* La fila entera selecciona con el mouse; con teclado se entra por el nombre. */}
                        <button
                          type="button"
                          className="alq-rq__open"
                          aria-current={elegido || undefined}
                          onClick={(e) => {
                            e.stopPropagation()
                            elegir(inquilino.id)
                          }}
                        >
                          {inquilino.name}
                        </button>
                      </h3>
                      <span className={CLASE_TAG[variante]}>{label}</span>
                    </div>
                    <p className="meta">
                      {formatPhone(inquilino.phone)} · {alquileresLabel(inquilino.finishedStays)}
                    </p>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>

      {seleccion ? (
        <TenantDetail
          ref={detalleRef}
          key={seleccion}
          tenantId={seleccion}
          assetId={assetId}
          userId={userId}
          onRated={actualizarClasificacion}
        />
      ) : (
        <aside className="panel rail alq-det" aria-label="Detalle del inquilino">
          <div className="empty empty--rail">
            <svg className="empty__i" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="8" r="3.5" />
              <path d="M5 20c0-3.5 3.1-5.5 7-5.5s7 2 7 5.5" />
            </svg>
            Elegí un inquilino para ver su historial y sus observaciones.
          </div>
        </aside>
      )}
    </div>
  )
}

export default TenantHistory
