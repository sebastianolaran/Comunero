import { useEffect, useState } from 'react'
import { createReservation, fetchReservations } from '../lib/api'
import { assetIdActual } from '../lib/currentAsset'
import { userIdActual } from '../lib/currentUser'
import {
  DIAS_SEMANA,
  diasDelMes,
  estadoDelDia,
  integrantesEnReservas,
  mesAnterior,
  mesSiguiente,
  nombreMes,
  primerDiaSemana,
  tonoDeIntegrante,
} from '../lib/calendar'
import './Calendario.css'

const HOY = new Date()

const ETIQUETA_ESTADO = {
  libre: 'Libre',
  reservado: 'Reservado',
  alquilado: 'Alquilado',
  rechazado: 'Rechazado',
}

function mesParam(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`
}

const FORM_INICIAL = {
  inicio: '',
  fin: '',
}

function Calendario() {
  // Quién entró y a qué bien: el router ya garantiza que hay sesión, pero se
  // resuelve acá y no al importar el módulo para que valga la de ahora.
  const assetId = assetIdActual()
  const userId = userIdActual()

  const [year, setYear] = useState(HOY.getUTCFullYear())
  const [month, setMonth] = useState(HOY.getUTCMonth() + 1)
  const [reservas, setReservas] = useState([])
  const [estadoCarga, setEstadoCarga] = useState('loading') // loading | ok | error
  // Se incrementa despues de crear una solicitud, para forzar el refetch
  // del mes y que el dia recien pedido se vea "pendiente" en la grilla.
  const [refreshKey, setRefreshKey] = useState(0)

  // Layout: el formulario vive en la columna lateral, oculto hasta que se
  // toca "Reservar" (igual que el prototipo).
  const [formAbierto, setFormAbierto] = useState(false)
  const [form, setForm] = useState(FORM_INICIAL)
  const [formError, setFormError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    let vivo = true

    fetchReservations(assetId, mesParam(year, month), { signal: controller.signal })
      .then((reservations) => {
        if (vivo) {
          setReservas(reservations)
          setEstadoCarga('ok')
        }
      })
      .catch((err) => {
        if (vivo && err.name !== 'AbortError') setEstadoCarga('error')
      })

    return () => {
      vivo = false
      controller.abort()
    }
  }, [assetId, year, month, refreshKey])

  const setCampo = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }))

  // Historia "Solicitar turno de uso propio". Las validaciones de fechas las
  // hace el backend; aca solo mostramos el error que devuelva.
  const handleSolicitar = async (e) => {
    e.preventDefault()
    setFormError(null)
    setEnviando(true)
    try {
      await createReservation({
        assetId,
        userId,
        startDate: form.inicio,
        endDate: form.fin,
      })
      setForm(FORM_INICIAL)
      setFormAbierto(false)
      setRefreshKey((k) => k + 1)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  const cancelarSolicitud = () => {
    setFormAbierto(false)
    setFormError(null)
    setForm(FORM_INICIAL)
  }

  const irMesAnterior = () => {
    const { year: y, month: m } = mesAnterior(year, month)
    setEstadoCarga('loading')
    setYear(y)
    setMonth(m)
  }

  const irMesSiguiente = () => {
    const { year: y, month: m } = mesSiguiente(year, month)
    setEstadoCarga('loading')
    setYear(y)
    setMonth(m)
  }

  if (!assetId) {
    return <p className="panel empty">No encontramos tu sesión. Volvé a entrar.</p>
  }

  const dias = diasDelMes(year, month)
  const espaciosVacios = primerDiaSemana(year, month)
  const espaciosFinales = (7 - ((espaciosVacios + dias.length) % 7)) % 7
  const integrantes = integrantesEnReservas(reservas)

  return (
    <div className="split split--fill">
      <section className="split__main" aria-label="Calendario">
        <header className="cal-head">
          <button
            type="button"
            className="btn btn--icon"
            onClick={irMesAnterior}
            aria-label="Mes anterior"
          >
            <svg className="btn__i" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h2 className="cal-head__t">{nombreMes(year, month).replace(' de ', ' ')}</h2>
          <button
            type="button"
            className="btn btn--icon"
            onClick={irMesSiguiente}
            aria-label="Mes siguiente"
          >
            <svg className="btn__i" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </header>

        {estadoCarga === 'error' && (
          <p className="note cal-error" role="alert">
            No se pudo cargar el calendario.
          </p>
        )}

        <div className="cal" aria-busy={estadoCarga === 'loading'}>
          {DIAS_SEMANA.map((nombreDia) => (
            <div key={nombreDia} className="cal__wd">
              {nombreDia}
            </div>
          ))}

          {Array.from({ length: espaciosVacios }).map((_, i) => (
            <div key={`antes-${i}`} className="cal__c cal__c--out" />
          ))}

          {dias.map((dia) => (
            <Dia key={dia.toISOString()} dia={dia} info={estadoDelDia(dia, reservas)} />
          ))}

          {Array.from({ length: espaciosFinales }).map((_, i) => (
            <div key={`despues-${i}`} className="cal__c cal__c--out" />
          ))}
        </div>

        <ul className="legend">
          {integrantes.map((i) => (
            <li key={i.userId} className="legend__i">
              <span className="legend__d" style={{ background: `oklch(56% 0.12 ${i.tono})` }} />
              {i.nombre}
            </li>
          ))}
          <li className="legend__i">
            <span className="legend__d cal-dot--alquilado" />
            Alquilado
          </li>
          <li className="legend__i">
            <span className="legend__d cal-dot--pendiente" />
            Pendiente
          </li>
          <li className="legend__i">
            <span className="legend__d cal-dot--rechazado" />
            Rechazado
          </li>
        </ul>
      </section>

      <aside className="rail cal-rail">
        <div className="panel">
          {!formAbierto && (
            <button
              type="button"
              className="btn btn--block btn--primary"
              title="Reservar días para uso propio. Los alquileres a terceros se cargan en Alquiler."
              onClick={() => setFormAbierto(true)}
            >
              Reservar
            </button>
          )}

          {formAbierto && (
            <form onSubmit={handleSolicitar}>
              <h2 className="cal-form__t">Nueva reserva</h2>
              <p className="hint cal-form__hint">
                Turno de uso propio. Para alquilar a un tercero, usá la sección Alquiler.
              </p>

              <div className="cal-form__fechas">
                <label className="lbl">
                  Desde
                  <input
                    className="in"
                    type="date"
                    value={form.inicio}
                    onChange={setCampo('inicio')}
                    required
                  />
                </label>
                <label className="lbl">
                  Hasta
                  <input
                    className="in"
                    type="date"
                    value={form.fin}
                    onChange={setCampo('fin')}
                    required
                  />
                </label>
              </div>

              {formError && (
                <p className="cal-form__err" role="alert">
                  {formError}
                </p>
              )}

              <div className="cal-form__acciones">
                <button type="button" className="btn btn--grow btn--sm" onClick={cancelarSolicitud}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn--grow btn--primary btn--sm" disabled={enviando}>
                  {enviando ? 'Enviando…' : 'Confirmar reserva'}
                </button>
              </div>
            </form>
          )}
        </div>
      </aside>
    </div>
  )
}

// Una celda del mes. Uso propio: tinte del tono del integrante (punteado si
// está pendiente) con sus iniciales; alquiler y rechazo tienen su propio estilo.
function Dia({ dia, info }) {
  const { estado } = info
  const clases = ['cal__c', 'cal__c--static', `cal__c--${estado}`]
  let etiqueta = ''
  let estilo

  if (estado === 'reservado') {
    if (info.pendiente) clases.push('cal__c--pendiente')
    estilo = { '--h': tonoDeIntegrante(info.userId) }
    etiqueta = (info.userName ?? '').slice(0, 2)
  } else if (estado === 'alquilado') {
    etiqueta = 'Alq.'
  } else if (estado === 'rechazado') {
    etiqueta = 'Rech.'
  }

  const titulo = info.userName
    ? `${ETIQUETA_ESTADO[estado]}: ${info.userName}${info.pendiente ? ' (pendiente)' : ''}`
    : ETIQUETA_ESTADO[estado]

  return (
    <div className={clases.join(' ')} style={estilo} title={titulo}>
      <span className="cal__n">{dia.getUTCDate()}</span>
      {etiqueta && <span className="cal__t">{etiqueta}</span>}
    </div>
  )
}

export default Calendario
