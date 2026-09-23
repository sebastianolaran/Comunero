import { useEffect, useId, useState } from 'react'
import { formatPhone, formatRange } from '../lib/rentalRequests'
import {
  MENSAJE_SIN_OBSERVACIONES,
  OPCIONES_CLASIFICACION,
  observacionMeta,
  validarObservacion,
} from '../lib/tenants'
import { commentTenant, fetchTenant, rateTenant } from '../services/tenant'

// Se monta con key={tenantId}: cada inquilino arranca con estado limpio.
function TenantDetail({ tenantId, assetId, userId, onRated }) {
  const [carga, setCarga] = useState({ estado: 'loading', detalle: null })
  const [clasificando, setClasificando] = useState({ guardando: false, error: null })
  const [borrador, setBorrador] = useState('')
  const [envio, setEnvio] = useState({ enviando: false, error: null })
  const idError = useId()

  useEffect(() => {
    const controller = new AbortController()
    fetchTenant(tenantId, { assetId, signal: controller.signal })
      .then((detalle) => setCarga({ estado: 'ok', detalle }))
      .catch((err) => {
        if (err.name !== 'AbortError') setCarga({ estado: 'error', detalle: null })
      })
    return () => controller.abort()
  }, [tenantId, assetId])

  async function clasificar(rating) {
    setClasificando({ guardando: true, error: null })
    try {
      const guardado = await rateTenant(tenantId, { userId, rating })
      setCarga((prev) => ({ ...prev, detalle: { ...prev.detalle, rating: guardado.rating } }))
      onRated(tenantId, guardado.rating)
      setClasificando({ guardando: false, error: null })
    } catch (err) {
      setClasificando({ guardando: false, error: err.message })
    }
  }

  async function agregarObservacion(e) {
    e.preventDefault()
    const { error, texto } = validarObservacion(borrador)
    if (error) {
      setEnvio({ enviando: false, error })
      return
    }
    setEnvio({ enviando: true, error: null })
    try {
      const nueva = await commentTenant(tenantId, { userId, text: texto })
      setCarga((prev) => ({
        ...prev,
        detalle: { ...prev.detalle, comments: [nueva, ...prev.detalle.comments] },
      }))
      setBorrador('')
      setEnvio({ enviando: false, error: null })
    } catch (err) {
      setEnvio({ enviando: false, error: err.message })
    }
  }

  if (carga.estado === 'loading') {
    return (
      <aside className="detalle" aria-label="Detalle del inquilino">
        <p className="detalle-vacio" role="status">
          Cargando inquilino…
        </p>
      </aside>
    )
  }

  if (carga.estado === 'error') {
    return (
      <aside className="detalle" aria-label="Detalle del inquilino">
        <p className="detalle-vacio" role="alert">
          No se pudo cargar el inquilino.
        </p>
      </aside>
    )
  }

  const { name, phone, rating, stays, comments } = carga.detalle
  const puedeEvaluar = Boolean(userId)

  return (
    <aside className="detalle" aria-label={`Detalle de ${name}`}>
      <h2 className="detalle-nombre">{name}</h2>
      <p className="detalle-contacto">{formatPhone(phone)}</p>

      <h3 className="detalle-seccion">Clasificación</h3>
      <div className="clasificacion-opciones" role="group" aria-label="Clasificación">
        {OPCIONES_CLASIFICACION.map((opcion) => (
          <button
            key={opcion.label}
            type="button"
            className="clasificacion-opcion"
            aria-pressed={rating === opcion.value}
            disabled={!puedeEvaluar || clasificando.guardando}
            onClick={() => rating !== opcion.value && clasificar(opcion.value)}
          >
            {opcion.label}
          </button>
        ))}
      </div>
      {clasificando.error && (
        <p className="detalle-error" role="alert">
          {clasificando.error}
        </p>
      )}

      {stays.length > 0 && (
        <>
          <h3 className="detalle-seccion">Alquileres anteriores</h3>
          <ul className="inquilino-estadias">
            {stays.map((s) => (
              <li key={s.startDate}>{formatRange(s.startDate, s.endDate)}</li>
            ))}
          </ul>
        </>
      )}

      <h3 className="detalle-seccion">Observaciones</h3>
      {comments.length === 0 ? (
        <p className="observaciones-vacio">{MENSAJE_SIN_OBSERVACIONES}</p>
      ) : (
        <ul className="observaciones">
          {comments.map((c) => (
            <li key={c.id} className="observacion">
              {c.text}
              <span className="observacion-meta">{observacionMeta(c)}</span>
            </li>
          ))}
        </ul>
      )}

      {puedeEvaluar && (
        <form onSubmit={agregarObservacion} noValidate>
          <textarea
            className="detalle-motivo"
            placeholder="Agregar una observación"
            aria-label="Nueva observación"
            aria-invalid={Boolean(envio.error) || undefined}
            aria-describedby={envio.error ? idError : undefined}
            maxLength={1000}
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
          />
          {envio.error && (
            <p id={idError} className="detalle-error" role="alert">
              {envio.error}
            </p>
          )}
          <button type="submit" className="detalle-boton is-primario observacion-agregar" disabled={envio.enviando}>
            Agregar observación
          </button>
        </form>
      )}
    </aside>
  )
}

export default TenantDetail
