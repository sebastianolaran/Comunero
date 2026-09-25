import { useEffect, useId, useState } from 'react'
import { useNavigate } from 'react-router'
import { formatPhone, formatRange } from '../lib/rentalRequests'
import {
  MENSAJE_SIN_OBSERVACIONES,
  OPCIONES_CLASIFICACION,
  observacionMeta,
  solicitudPrecargada,
  validarObservacion,
} from '../lib/tenants'
import { commentTenant, fetchTenant, rateTenant } from '../services/tenant'

// Se monta con key={tenantId}: cada inquilino arranca con estado limpio.
function TenantDetail({ ref, tenantId, assetId, userId, onRated }) {
  const [carga, setCarga] = useState({ estado: 'loading', detalle: null })
  const [clasificando, setClasificando] = useState({ guardando: false, error: null })
  const [borrador, setBorrador] = useState('')
  const [envio, setEnvio] = useState({ enviando: false, error: null })
  const idError = useId()
  const navigate = useNavigate()

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
      <aside ref={ref} tabIndex={-1} className="panel rail alq-det" aria-label="Detalle del inquilino">
        <p className="empty" role="status">
          Cargando inquilino…
        </p>
      </aside>
    )
  }

  if (carga.estado === 'error') {
    return (
      <aside ref={ref} tabIndex={-1} className="panel rail alq-det" aria-label="Detalle del inquilino">
        <p className="empty" role="alert">
          No se pudo cargar el inquilino.
        </p>
      </aside>
    )
  }

  const { name, phone, rating, stays, comments } = carga.detalle
  const puedeEvaluar = Boolean(userId)

  return (
    <aside ref={ref} tabIndex={-1} className="panel rail alq-det" aria-label={`Detalle de ${name}`}>
      <h2 className="alq-det__name">{name}</h2>
      <p className="meta alq-det__contact">{formatPhone(phone)}</p>
      <h3 className="sect alq-det__sect">Clasificación</h3>
      <div className="seg seg--stack alq-det__bloque" role="group" aria-label="Clasificación">
        {OPCIONES_CLASIFICACION.map((opcion) => (
          <button
            key={opcion.label}
            type="button"
            className={rating === opcion.value ? 'seg__b seg__b--on' : 'seg__b'}
            aria-pressed={rating === opcion.value}
            disabled={!puedeEvaluar || clasificando.guardando}
            onClick={() => rating !== opcion.value && clasificar(opcion.value)}
          >
            {opcion.label}
          </button>
        ))}
      </div>
      {clasificando.error && (
        <p className="alq-err alq-det__bloque" role="alert">
          {clasificando.error}
        </p>
      )}

      {stays.length > 0 && (
        <>
          <h3 className="sect alq-det__sect">Alquileres anteriores</h3>
          <ul className="alq-det__estadias">
            {stays.map((s) => (
              <li key={s.startDate}>{formatRange(s.startDate, s.endDate)}</li>
            ))}
          </ul>
        </>
      )}

      <h3 className="sect alq-det__sect">Observaciones</h3>
      {comments.length === 0 ? (
        <p className="empty alq-det__bloque">{MENSAJE_SIN_OBSERVACIONES}</p>
      ) : (
        <ul className="alq-det__objeciones">
          {comments.map((c) => (
            <li key={c.id} className="note note--body alq-obs">
              {c.text}
              <span className="alq-obs__meta">{observacionMeta(c)}</span>
            </li>
          ))}
        </ul>
      )}

      {puedeEvaluar && (
        <form onSubmit={agregarObservacion} noValidate>
          <textarea
            className="ta alq-det__motivo"
            placeholder="Agregar una observación"
            aria-label="Nueva observación"
            aria-invalid={Boolean(envio.error) || undefined}
            aria-describedby={envio.error ? idError : undefined}
            maxLength={1000}
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
          />
          {envio.error && (
            <p id={idError} className="alq-err alq-det__bloque" role="alert">
              {envio.error}
            </p>
          )}
          <button type="submit" className="btn btn--block btn--primary" disabled={envio.enviando}>
            Agregar observación
          </button>
        </form>
      )}

      {puedeEvaluar && (
        <button
          type="button"
          className="btn btn--block alq-det__pie"
          onClick={() =>
            navigate('/alquiler/solicitudes', { state: { nuevaSolicitud: solicitudPrecargada({ name, phone }) } })
          }
        >
          + Nueva solicitud para este inquilino
        </button>
      )}
    </aside>
  )
}

export default TenantDetail
