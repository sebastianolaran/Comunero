import { useEffect, useId, useState } from 'react'
import { useParams } from 'react-router'
import Icono from '../components/Iconos'
import { validarSolicitudPublica } from '../lib/listing'
import { daysLabel, formatMoney, formatRange, hoyLocal, montoSugerido } from '../lib/rentalRequests'
import { fetchPublicListing, photoUrl, sendPublicRequest } from '../services/listing'
import './FichaPublica.css'

const VACIO = { name: '', phone: '', email: '', startDate: '', endDate: '', guests: '', comments: '', website: '' }
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

function Detalle({ ficha }) {
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

function Formulario({ slug, ficha }) {
  const [borrador, setBorrador] = useState(VACIO)
  const [errores, setErrores] = useState({})
  const [envio, setEnvio] = useState({ estado: 'editando', error: null, pedido: null })
  const base = useId()
  const hoy = hoyLocal()
  const id = (campo) => `${base}-${campo}`
  const estimado = montoSugerido(borrador.startDate, borrador.endDate, ficha.rentalDailyRate)

  const cambiar = (campo) => (e) => {
    setBorrador((prev) => ({ ...prev, [campo]: e.target.value }))
    setErrores((prev) => ({ ...prev, [campo]: undefined }))
  }
  const props = (campo) => ({
    id: id(campo),
    value: borrador[campo],
    onChange: cambiar(campo),
    'aria-invalid': errores[campo] ? true : undefined,
    'aria-describedby': errores[campo] ? `${id(campo)}-error` : undefined,
  })

  async function enviar(e) {
    e.preventDefault()
    const { errores: encontrados, pedido } = validarSolicitudPublica(borrador, { hoy, capacidad: ficha.capacity })
    setErrores(encontrados)
    if (!pedido) return
    setEnvio({ estado: 'enviando', error: null, pedido: null })
    try {
      await sendPublicRequest(slug, pedido)
      setEnvio({ estado: 'enviada', error: null, pedido })
    } catch (err) {
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
          <Campo id={id('startDate')} label="Llegada" error={errores.startDate}>
            <input className="fp-in" type="date" min={hoy} {...props('startDate')} />
          </Campo>
          <Campo id={id('endDate')} label="Salida" error={errores.endDate}>
            <input className="fp-in" type="date" min={borrador.startDate || hoy} {...props('endDate')} />
          </Campo>
        </div>
        <Campo id={id('guests')} label="Personas" error={errores.guests} className="fp-campo--borde">
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
        <Campo id={id('name')} label="Nombre y apellido" error={errores.name}>
          <input className="in" autoComplete="name" maxLength={100} {...props('name')} />
        </Campo>
        <Campo id={id('phone')} label="Teléfono" error={errores.phone}>
          <input className="in" type="tel" autoComplete="tel" maxLength={30} {...props('phone')} />
        </Campo>
        <Campo id={id('email')} label="Email" opcional error={errores.email}>
          <input className="in" type="email" autoComplete="email" maxLength={254} {...props('email')} />
        </Campo>
        <Campo id={id('comments')} label="Comentario" opcional error={errores.comments}>
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

function FichaPublica() {
  const { slug } = useParams()
  const [carga, setCarga] = useState({ estado: 'loading', ficha: null })

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
            <p className="hint">El link no corresponde a ninguna ficha. Conviene revisarlo con quien lo compartió.</p>
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
              <Detalle ficha={ficha} />
              <aside className="fp-panel" aria-label="Pedir fechas">
                <Formulario slug={slug} ficha={ficha} />
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
