import { useEffect, useRef, useState } from 'react'
import TenantDetail from '../components/TenantDetail'
import Pagination from '../components/Pagination'
import { Cargando, ErrorCarga, Vacio } from '../components/ui/Estado'
import { assetIdActual } from '../lib/currentAsset'
import { userIdActual } from '../lib/currentUser'
import { formatPhone } from '../lib/rentalRequests'
import { alquileresLabel, clasificacion, conClasificacion, mensajeVacio } from '../lib/tenants'
import { fetchTenants } from '../services/tenant'
import { useDetalleEnMobile } from '../lib/useDetalleEnMobile'
import { usePaginacion } from '../lib/pagination'

const DEBOUNCE_MS = 250

const CLASE_TAG = { solida: 'tag tag--solid tag--si', normal: 'tag tag--no', punteada: 'tag tag--dash' }

function TenantHistory({ assetId = assetIdActual(), userId = userIdActual() }) {
  const [busqueda, setBusqueda] = useState('')
  const [carga, setCarga] = useState({ estado: 'loading', inquilinos: [], busqueda: '' })
  const [intento, setIntento] = useState(0)
  const escribiendo = useRef(false)
  const [seleccion, setSeleccion] = useState(null)
  const [detalleRef, mostrarDetalle] = useDetalleEnMobile()
  const inquilinosOrdenados = [...carga.inquilinos].sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const paginacion = usePaginacion(inquilinosOrdenados, busqueda)

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
    return <Vacio panel titulo="La sesión no está activa.">Ingresar de nuevo para continuar.</Vacio>
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
          <Cargando>Cargando inquilinos…</Cargando>
        )}

        {carga.estado === 'error' && (
          <ErrorCarga titulo="No se pudo cargar el historial de inquilinos." onReintentar={reintentar} />
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
              {paginacion.elementos.map((inquilino) => {
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
            <Pagination {...paginacion} />
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
            Elegir un inquilino para ver su historial y sus observaciones.
          </div>
        </aside>
      )}
    </div>
  )
}

export default TenantHistory
