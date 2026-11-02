import { useEffect, useId, useState } from 'react'
import { useParams } from 'react-router'
import CalendarioDisponibilidad from '../components/CalendarioDisponibilidad'
import Icono from '../components/Iconos'
import { validarSolicitudPublica } from '../lib/listing'
import { daysLabel, formatMoney, formatRange, hoyLocal, montoSugerido } from '../lib/rentalRequests'
import { fetchAvailability, fetchPublicListing, photoUrl, sendPublicRequest } from '../services/listing'
import './FichaPublica.css'

const VACIO = { name: '', phone: '', email: '', guests: '', comments: '', website: '' }
const MINIATURAS = 4

const personas = (n) => `${n} ${n === 1 ? 'persona' : 'personas'}`

function Galeria({ slug, fotos, nombre }) {
  const [actual, setActual] = useState(0)
  if (fotos.length === 0) return null

  const total = fotos.length
  const mover = (paso) => setActual((i) => (i + paso + total) % total)
  // Las que no están en grande, en orden a partir de la actual.
  const resto = Array.from({ length: total - 1 }, (_, k) => (actual + k + 1) % total).slice(0, MINIATURAS)
  const clases = ['fp-gal', total === 1 && 'fp-gal--una', total === 2 && 'fp-gal--dos'].filter(Boolean).join(' ')

  return (
    <section className={clases} aria-label="Fotos">
      <figure className="fp-gal__main">
        <img key={fotos[actual].id} src={photoUrl(slug, fotos[actual].id)} alt={`${nombre}, foto ${actual + 1} de ${total}`} />
        {total > 1 && (
          <figcaption className="fp-gal__ctl">
            <button type="button" className="fp-gal__nav" aria-label="Foto anterior" onClick={() => mover(-1)}>
              <Icono nombre="atras" className="fp-i" />
            </button>
            <span className="fp-gal__count" aria-live="polite">
              {actual + 1} / {total}
            </span>
            <button type="button" className="fp-gal__nav" aria-label="Foto siguiente" onClick={() => mover(1)}>
              <Icono nombre="siguiente" className="fp-i" />
            </button>
          </figcaption>
        )}
      </figure>
      {resto.length > 0 && (
        <ul className="fp-gal__resto">
          {resto.map((i) => (
            <li key={fotos[i].id}>
              <button type="button" className="fp-gal__tile" aria-label={`Ver foto ${i + 1}`} onClick={() => setActual(i)}>
                <img src={photoUrl(slug, fotos[i].id)} alt="" loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Datos({ ficha }) {
  const datos = [
    ficha.approxLocation && { icono: 'ubicacion', label: 'Zona', valor: ficha.approxLocation },
    ficha.capacity != null && { icono: 'personas', label: 'Capacidad', valor: `Hasta ${personas(ficha.capacity)}` },
    ficha.rentalDailyRate != null && {
      icono: 'precio',
      label: 'Precio de referencia',
      valor: `${formatMoney(ficha.rentalDailyRate)} por día`,
    },
  ].filter(Boolean)
  if (datos.length === 0) return null
  return (
    <dl className="fp-datos">
      {datos.map((d) => (
        <div key={d.label} className="fp-datos__item">
          <Icono nombre={d.icono} className="fp-i fp-datos__i" />
          <dt>{d.label}</dt>
          <dd>{d.valor}</dd>
        </div>
      ))}
    </dl>
  )
}

function Seccion({ titulo, children }) {
  const id = useId()
  return (
    <section className="fp-sec" aria-labelledby={id}>
      <h2 id={id} className="fp-sec__t">
        {titulo}
      </h2>
      {children}
    </section>
  )
}

function Detalle({ ficha, children }) {
  const vacia = !ficha.description && ficha.services.length === 0 && !ficha.conditions
  return (
    <div className="fp-det">
      {ficha.description && (
        <Seccion titulo="El lugar">
          <p className="fp-det__texto">{ficha.description}</p>
        </Seccion>
      )}
      {ficha.services.length > 0 && (
        <Seccion titulo="Servicios">
          <ul className="fp-servicios">
            {ficha.services.map((s) => (
              <li key={s}>
                <Icono nombre="check" className="fp-i fp-servicios__i" />
                {s}
              </li>
            ))}
          </ul>
        </Seccion>
      )}
      {ficha.conditions && (
        <Seccion titulo="Condiciones de alquiler">
          <p className="fp-det__texto">{ficha.conditions}</p>
        </Seccion>
      )}
      {vacia && <p className="hint">Los detalles del lugar se pueden consultar en el comentario de la solicitud.</p>}
      {children}
    </div>
  )
}

function Campo({ id, label, error, opcional = false, className = '', children }) {
  return (
    <div className={`fp-campo ${className}`}>
      <label className="fp-campo__l" htmlFor={id}>
        {label}
        {opcional && <span className="fp-campo__opc">opcional</span>}
      </label>
      {children}
      {error && (
        <p className="fp-form__error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  )
}

function Enviada({ pedido }) {
  return (
    <div className="fp-ok" role="status">
      <span className="fp-ok__marca" aria-hidden="true">
        <Icono nombre="check" className="fp-i" />
      </span>
      <h2 className="fp-ok__t">Solicitud enviada</h2>
      <dl className="fp-ok__resumen">
        <div>
          <dt>Fechas</dt>
          <dd>
            {formatRange(pedido.startDate, pedido.endDate)} · {daysLabel(pedido.startDate, pedido.endDate)}
          </dd>
        </div>
        <div>
          <dt>Personas</dt>
          <dd>{pedido.guests}</dd>
        </div>
      </dl>
      <p className="fp-ok__texto">
        Las personas a cargo del lugar la revisan entre todas y se comunican al teléfono indicado. Enviarla no confirma la
        reserva.
      </p>
    </div>
  )
}

// fechas: { startDate, endDate }, compartidas con el calendario de disponibilidad.
function Formulario({ slug, ficha, hoy, ocupados, fechas, onFechas, onOcupadas }) {
  const [borrador, setBorrador] = useState(VACIO)
  const [errores, setErrores] = useState({})
  // Los errores de fecha valen para las fechas con que se validó: si después se
  // eligen otras (por ejemplo tocando el calendario), dejan de mostrarse.
  const [fechasValidadas, setFechasValidadas] = useState(fechas)
  const [envio, setEnvio] = useState({ estado: 'editando', error: null, pedido: null })
  const base = useId()
  const id = (campo) => `${base}-${campo}`
  const mismasFechas = fechasValidadas.startDate === fechas.startDate && fechasValidadas.endDate === fechas.endDate
  const visibles = mismasFechas ? errores : { ...errores, startDate: undefined, endDate: undefined }
  const estimado = montoSugerido(fechas.startDate, fechas.endDate, ficha.rentalDailyRate)

  const cambiar = (campo) => (e) => {
    const valor = e.target.value
    if (campo in fechas) onFechas({ ...fechas, [campo]: valor })
    else setBorrador((prev) => ({ ...prev, [campo]: valor }))
    setErrores((prev) => ({ ...prev, [campo]: undefined }))
  }
  const props = (campo) => ({
    id: id(campo),
    value: campo in fechas ? fechas[campo] : borrador[campo],
    onChange: cambiar(campo),
    'aria-invalid': visibles[campo] ? true : undefined,
    'aria-describedby': visibles[campo] ? `${id(campo)}-error` : undefined,
  })

  async function enviar(e) {
    e.preventDefault()
    const { errores: encontrados, pedido } = validarSolicitudPublica(
      { ...borrador, ...fechas },
      { hoy, capacidad: ficha.capacity, ocupados },
    )
    setErrores(encontrados)
    setFechasValidadas(fechas)
    if (!pedido) return
    setEnvio({ estado: 'enviando', error: null, pedido: null })
    try {
      await sendPublicRequest(slug, pedido)
      setEnvio({ estado: 'enviada', error: null, pedido })
    } catch (err) {
      // Alguien aprobó esas fechas mientras tanto: se actualiza el calendario.
      if (err.status === 409) onOcupadas()
      if (err.field) setErrores({ [err.field]: err.message })
      setEnvio({ estado: 'editando', error: err.field ? null : err.message, pedido: null })
    }
  }

  if (envio.estado === 'enviada') return <Enviada pedido={envio.pedido} />

  return (
    <form className="fp-form" onSubmit={enviar} noValidate>
      <div className="fp-form__head">
        <h2 className="fp-form__t">Pedir fechas</h2>
        {ficha.rentalDailyRate != null && (
          <p className="fp-form__precio">
            <span className="fp-form__monto">{formatMoney(ficha.rentalDailyRate)}</span>
            <span className="meta">por día</span>
          </p>
        )}
      </div>

      <fieldset className="fp-estadia">
        <legend className="fp-sr">Estadía</legend>
        <div className="fp-fechas">
          <Campo id={id('startDate')} label="Llegada" error={visibles.startDate}>
            <input className="fp-in" type="date" min={hoy} {...props('startDate')} />
          </Campo>
          <Campo id={id('endDate')} label="Salida" error={visibles.endDate}>
            <input className="fp-in" type="date" min={fechas.startDate || hoy} {...props('endDate')} />
          </Campo>
        </div>
        <Campo id={id('guests')} label="Personas" error={visibles.guests} className="fp-campo--borde">
          <input
            className="fp-in"
            inputMode="numeric"
            autoComplete="off"
            placeholder={ficha.capacity != null ? `Hasta ${ficha.capacity}` : undefined}
            {...props('guests')}
          />
        </Campo>
      </fieldset>

      {estimado && (
        <div className="fp-total">
          <dl className="fp-total__fila">
            <dt>
              Estimado <span className="fp-total__det">{estimado.detalle}</span>
            </dt>
            <dd>{formatMoney(estimado.monto)}</dd>
          </dl>
          <p className="fp-total__nota">El monto final se confirma al responder la solicitud.</p>
        </div>
      )}

      <fieldset className="fp-contacto">
        <legend className="fp-form__sub">Datos de contacto</legend>
        <Campo id={id('name')} label="Nombre y apellido" error={visibles.name}>
          <input className="in" autoComplete="name" maxLength={100} {...props('name')} />
        </Campo>
        <Campo id={id('phone')} label="Teléfono" error={visibles.phone}>
          <input className="in" type="tel" autoComplete="tel" maxLength={30} {...props('phone')} />
        </Campo>
        <Campo id={id('email')} label="Email" opcional error={visibles.email}>
          <input className="in" type="email" autoComplete="email" maxLength={254} {...props('email')} />
        </Campo>
        <Campo id={id('comments')} label="Comentario" opcional error={visibles.comments}>
          <textarea className="ta" rows={3} maxLength={500} placeholder="Horario de llegada, mascotas, consultas…" {...props('comments')} />
        </Campo>
      </fieldset>

      {/* Trampa para bots: invisible y fuera del orden de tabulación. */}
      <div className="fp-form__trampa" aria-hidden="true">
        <label>
          Sitio web
          <input tabIndex={-1} autoComplete="off" value={borrador.website} onChange={cambiar('website')} />
        </label>
      </div>

      {envio.error && (
        <p className="fp-form__error" role="alert">
          {envio.error}
        </p>
      )}
      <button type="submit" className="btn btn--primary btn--block fp-form__enviar" disabled={envio.estado === 'enviando'}>
        {envio.estado === 'enviando' ? 'Enviando…' : 'Enviar solicitud'}
      </button>
      <p className="fp-form__pie">
        Todavía no se cobra nada. Los datos solo los ven las personas a cargo del lugar.
      </p>
    </form>
  )
}

function Estado({ titulo, children, alerta = false }) {
  return (
    <div className="fp__aviso" role={alerta ? 'alert' : 'status'}>
      {titulo && <h1 className="fp-nombre fp-nombre--chico">{titulo}</h1>}
      {children}
    </div>
  )
}

// Si no carga, la ficha sigue andando: el server igual rechaza fechas ocupadas.
function useOcupados(slug) {
  const [ocupados, setOcupados] = useState([])
  const [intento, setIntento] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    fetchAvailability(slug, { signal: controller.signal })
      .then(setOcupados)
      .catch(() => {})
    return () => controller.abort()
  }, [slug, intento])
  return [ocupados, () => setIntento((n) => n + 1)]
}

function FichaPublica() {
  const { slug } = useParams()
  const [carga, setCarga] = useState({ estado: 'loading', ficha: null })
  const [ocupados, recargarOcupados] = useOcupados(slug)
  const [fechas, setFechas] = useState({ startDate: '', endDate: '' })
  const hoy = hoyLocal()

  useEffect(() => {
    const controller = new AbortController()
    fetchPublicListing(slug, { signal: controller.signal })
      .then((ficha) => setCarga({ estado: 'ok', ficha }))
      .catch((err) => {
        if (err.name === 'AbortError') return
        setCarga({ estado: err.status === 404 ? 'no-existe' : 'error', ficha: null, error: err.message })
      })
    return () => controller.abort()
  }, [slug])

  useEffect(() => {
    if (carga.ficha) document.title = `${carga.ficha.name} · Comunero`
  }, [carga.ficha])

  const { ficha } = carga

  return (
    <div className="fp">
      <header className="fp__top">
        <div className="fp__in fp__top-in">
          <span className="brand__n">Comunero</span>
          <span className="meta">Ficha de alquiler</span>
        </div>
      </header>

      <main className="fp__in fp__main">
        {carga.estado === 'loading' && (
          <Estado>
            <p className="hint">Cargando ficha… La primera visita puede tardar hasta un minuto.</p>
          </Estado>
        )}
        {carga.estado === 'no-existe' && (
          <Estado titulo="Ficha no encontrada">
            <p className="hint">El link no corresponde a ninguna ficha publicada: puede estar pausada o haber cambiado. Conviene consultarlo con quien lo compartió.</p>
          </Estado>
        )}
        {carga.estado === 'error' && (
          <Estado titulo="No se pudo cargar la ficha" alerta>
            <p className="hint">{carga.error}</p>
          </Estado>
        )}
        {carga.estado === 'ok' && (
          <>
            <div className="fp-cabecera">
              <h1 className="fp-nombre">{ficha.name}</h1>
              <Datos ficha={ficha} />
            </div>
            <Galeria slug={slug} fotos={ficha.photos} nombre={ficha.name} />
            <div className="fp__grid">
              <Detalle ficha={ficha}>
                <Seccion titulo="Disponibilidad">
                  <CalendarioDisponibilidad
                    ocupados={ocupados}
                    hoy={hoy}
                    desde={fechas.startDate}
                    hasta={fechas.endDate}
                    onElegir={setFechas}
                  />
                </Seccion>
              </Detalle>
              <aside className="fp-panel" aria-label="Pedir fechas">
                <Formulario
                  slug={slug}
                  ficha={ficha}
                  hoy={hoy}
                  ocupados={ocupados}
                  fechas={fechas}
                  onFechas={setFechas}
                  onOcupadas={recargarOcupados}
                />
              </aside>
            </div>
          </>
        )}
      </main>

      <footer className="fp__in">
        <p className="fp__pie meta">Publicado con Comunero</p>
      </footer>
    </div>
  )
}

export default FichaPublica
