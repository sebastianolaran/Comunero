import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { fetchReservations } from '../lib/api'
import { assetIdActual } from '../lib/currentAsset'
import { userIdActual } from '../lib/currentUser'
import ExportarCalendario from '../components/ExportarCalendario'
import { Cargando, ErrorCarga, Vacio } from '../components/ui/Estado'
import { formatRange, hoyLocal } from '../lib/rentalRequests'
import {
  colorDeIntegrante,
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

const formateadorDetalle = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
})

function fechaDetalle(dia) {
  return formateadorDetalle.format(dia)
}

function fechaSolo(valor) {
  return typeof valor === 'string' ? valor.slice(0, 10) : valor
}

// Solo para mirar: reservar, votar, cancelar e intercambiar se hace en
// Reservas. Desde ahí "Ver en el calendario" llega con { fecha, reservaId }:
// abre ese mes con el día elegido y, si está pendiente, la marca en la grilla.
function Calendario() {
  const assetId = assetIdActual()
  const destino = useLocation().state
  const [anioDestino, mesDestino] = destino?.fecha ? destino.fecha.split('-').map(Number) : []

  const [year, setYear] = useState(anioDestino ?? HOY.getUTCFullYear())
  const [month, setMonth] = useState(mesDestino ?? HOY.getUTCMonth() + 1)
  const [reservas, setReservas] = useState([])
  const [estadoCarga, setEstadoCarga] = useState('loading') // loading | ok | error
  const [intento, setIntento] = useState(0)
  const [diaSeleccionado, setDiaSeleccionado] = useState(destino?.fecha ? `${destino.fecha}T00:00:00.000Z` : null)
  const destacadaId = destino?.reservaId ?? null

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
  }, [assetId, year, month, intento])

  const irAMes = ({ year: y, month: m }) => {
    setEstadoCarga('loading')
    setDiaSeleccionado(null)
    setYear(y)
    setMonth(m)
  }

  const [anioHoy, mesHoy, diaHoy] = hoyLocal().split('-').map(Number)
  const hoyIso = new Date(Date.UTC(anioHoy, mesHoy - 1, diaHoy)).toISOString()
  const irAHoy = () => {
    if (year !== anioHoy || month !== mesHoy) irAMes({ year: anioHoy, month: mesHoy })
    setDiaSeleccionado(hoyIso)
  }

  if (!assetId) {
    return <Vacio panel titulo="La sesión no está activa.">Ingresar de nuevo para continuar.</Vacio>
  }

  const dias = diasDelMes(year, month)
  const espaciosVacios = primerDiaSemana(year, month)
  const espaciosFinales = (7 - ((espaciosVacios + dias.length) % 7)) % 7
  const integrantes = integrantesEnReservas(reservas)
  const destacada = reservas.find((reserva) => reserva.id === destacadaId && reserva.status === 'PENDING')

  return (
    <div className="split split--fill">
      <section className="split__main" aria-label="Calendario">
        <header className="cal-head">
          <button type="button" className="btn btn--icon" onClick={() => irAMes(mesAnterior(year, month))} aria-label="Mes anterior">
            <svg className="btn__i" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h2 className="cal-head__t">{nombreMes(year, month).replace(' de ', ' ')}</h2>
          <div className="cal-head__der">
            <button type="button" className="btn btn--sm" onClick={irAHoy} disabled={diaSeleccionado === hoyIso}>
              Hoy
            </button>
            <button type="button" className="btn btn--icon" onClick={() => irAMes(mesSiguiente(year, month))} aria-label="Mes siguiente">
              <svg className="btn__i" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        </header>

        {destacada && (
          <div className="cal-preview" aria-live="polite">
            <p className="cal-preview__text">
              Pedido pendiente de {destacada.user?.name ?? 'un integrante'}:{' '}
              {formatRange(fechaSolo(destacada.startDate), fechaSolo(destacada.endDate))}. Todavía no está aprobado: en el
              calendario se ve con borde punteado.
            </p>
            <Link className="btn btn--link cal-preview__action" to="/reservas" state={{ tab: 'votar' }}>
              Votar en Reservas
            </Link>
          </div>
        )}

        {estadoCarga === 'error' && (
          <ErrorCarga
            titulo="No se pudo cargar el calendario."
            onReintentar={() => {
              setEstadoCarga('loading')
              setIntento((n) => n + 1)
            }}
          />
        )}

        <div className="cal" aria-busy={estadoCarga === 'loading'}>
          {estadoCarga === 'loading' && (
            <div className="cal__cargando">
              <Cargando panel={false}>Cargando las reservas del mes…</Cargando>
            </div>
          )}
          {DIAS_SEMANA.map((nombreDia) => (
            <div key={nombreDia} className="cal__wd">
              {nombreDia}
            </div>
          ))}

          {Array.from({ length: espaciosVacios }).map((_, i) => (
            <div key={`antes-${i}`} className="cal__c cal__c--out" />
          ))}

          {dias.map((dia) => (
            <Dia
              key={dia.toISOString()}
              dia={dia}
              info={estadoDelDia(dia, reservas, destacadaId)}
              seleccionado={diaSeleccionado === dia.toISOString()}
              hoy={dia.toISOString().slice(0, 10) === hoyLocal()}
              pasado={dia.toISOString().slice(0, 10) < hoyLocal()}
              cargando={estadoCarga === 'loading'}
              onSelect={() => setDiaSeleccionado(dia.toISOString())}
            />
          ))}

          {Array.from({ length: espaciosFinales }).map((_, i) => (
            <div key={`despues-${i}`} className="cal__c cal__c--out" />
          ))}
        </div>

        <ul className="legend">
          {integrantes.map((i) => (
            <li key={i.userId} className="legend__i">
              <span className="legend__d" style={{ background: colorDeIntegrante(i.userId, i.tono) }} />
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
        <DetalleDia dia={diaSeleccionado ? new Date(diaSeleccionado) : null} reservas={reservas} destacadaId={destacadaId} />
        <div className="panel">
          <Link className="btn btn--block btn--primary" to="/reservas" state={{ nuevaReserva: true }}>
            Reservar
          </Link>
          <p className="hint cal-rail__hint">Reservar, votar, cancelar e intercambiar turnos se hace en Reservas.</p>
        </div>
        <ExportarCalendario assetId={assetId} userId={userIdActual()} />
      </aside>
    </div>
  )
}

function DetalleDia({ dia, reservas, destacadaId }) {
  const info = dia ? estadoDelDia(dia, reservas, destacadaId) : null
  let descripcion = 'Elegir un día del calendario para ver su detalle.'

  if (dia && info.estado === 'libre') {
    descripcion = 'Día disponible para ser reservado.'
  } else if (dia && info.estado === 'reservado') {
    const nombre = info.userName ?? 'un integrante'
    descripcion = info.pendiente ? `Reserva pendiente de ${nombre}.` : `Reserva confirmada de ${nombre}.`
  } else if (dia && info.estado === 'alquilado') {
    return <DetalleAlquiler dia={dia} alquiler={info.alquiler} />
  } else if (dia && info.estado === 'rechazado') {
    descripcion = 'Reserva rechazada.'
  }

  return (
    <div className="panel cal-detail" aria-live="polite">
      {dia && <h2 className="cal-detail__t">{fechaDetalle(dia)}</h2>}
      <p className="cal-detail__d">{descripcion}</p>
      {dia && info?.estado === 'reservado' && (
        <Link className="btn btn--link" to="/reservas">
          Ver en Reservas
        </Link>
      )}
    </div>
  )
}

function DetalleAlquiler({ dia, alquiler }) {
  const tareas = alquiler.tasks ?? []
  const pendientes = tareas.filter((tarea) => !tarea.completed).length
  const monto = alquiler.amount == null ? null : `$${alquiler.amount.toLocaleString('es-AR')}`
  const pendiente = alquiler.status === 'PENDING'

  return (
    <div className="panel cal-detail" aria-live="polite">
      <h2 className="cal-detail__t">{fechaDetalle(dia)}</h2>
      <p className="cal-detail__d">
        {pendiente ? 'Alquiler pendiente de aprobación para' : 'Alquilado a'}{' '}
        {alquiler.renter?.name ?? 'un huésped'}
        {alquiler.renter?.phone && ` · Tel: ${alquiler.renter.phone}`}
        {monto && ` · Monto total: ${monto}`}
      </p>
      <p className="cal-detail__managed">
        {alquiler.userId ? `Gestionado por ${alquiler.user?.name ?? 'un copropietario'}` : 'Llegó desde la ficha pública'}
      </p>

      {/* Las tareas se marcan en Alquileres > Tareas de preparación; acá solo se ven. */}
      {!pendiente && (
        <>
          <h3 className="cal-detail__sect">Tareas de preparación · {pendientes} pendientes</h3>
          {tareas.length === 0 ? (
            <p className="cal-detail__empty">No hay tareas de preparación.</p>
          ) : (
            <ul className="cal-detail__tasks" role="list">
              {tareas.map((tarea) => (
                <li key={tarea.id} className="cal-detail__task">
                  <span className={tarea.completed ? 'task__t task__t--done' : 'task__t'}>
                    {tarea.name}
                    <span className="solo-lector">{tarea.completed ? ' (hecha)' : ' (pendiente)'}</span>
                  </span>
                  <span className="meta">{tarea.assignedTo?.name ?? 'Sin responsable'}</span>
                </li>
              ))}
            </ul>
          )}
          <Link className="btn btn--link" to="/alquiler/tareas-preparacion">
            Ir a Tareas de preparación
          </Link>
        </>
      )}
    </div>
  )
}

const ABREVIATURAS = { Alquiler: 'Alq.', Rechazado: 'Rech.' }
const abreviar = (etiqueta) => ABREVIATURAS[etiqueta] ?? etiqueta.slice(0, 2)

// Una celda del mes. Uso propio: tinte del tono del integrante (punteado si
// está pendiente) con sus iniciales; alquiler y rechazo tienen su propio estilo.
function Dia({ dia, info, seleccionado, hoy, pasado, cargando, onSelect }) {
  const { estado } = info
  const clases = ['cal__c', `cal__c--${estado}`]
  if (seleccionado) clases.push('cal__c--on')
  if (hoy) clases.push('cal__c--hoy')
  if (pasado) clases.push('cal__c--pasado')
  let etiqueta = ''
  let estilo

  if (estado === 'reservado') {
    if (info.pendiente) clases.push('cal__c--pendiente')
    estilo = { '--h': tonoDeIntegrante(info.userId, info.hue) }
    etiqueta = info.userName ?? ''
  } else if (estado === 'alquilado') {
    // Pendiente de aprobacion: borde punteado, como el uso propio.
    if (info.pendiente) clases.push('cal__c--pendiente')
    etiqueta = 'Alquiler'
  } else if (estado === 'rechazado') {
    etiqueta = 'Rechazado'
  }

  const sufijo = info.pendiente ? ' (pendiente)' : ''
  // Mientras carga, la grilla vacía no tiene que anunciar "Libre".
  const titulo = cargando
    ? 'Cargando'
    : info.userName
    ? `${ETIQUETA_ESTADO[estado]}: ${info.userName}${sufijo}`
    : `${ETIQUETA_ESTADO[estado]}${sufijo}`

  return (
    <button
      type="button"
      className={clases.join(' ')}
      style={estilo}
      title={titulo}
      aria-label={`${hoy ? 'Hoy, ' : ''}${fechaDetalle(dia)}. ${titulo}`}
      aria-pressed={seleccionado}
      aria-current={hoy ? 'date' : undefined}
      onClick={onSelect}
    >
      <span className="cal__n">
        {dia.getUTCDate()}
        {hoy && <span className="cal__hoy">Hoy</span>}
      </span>
      {etiqueta && (
        <span className="cal__t">
          <span className="cal__t-largo">{etiqueta}</span>
          {/* En mobile la celda mide ~47px: va la abreviatura; el nombre completo está en el detalle del día. */}
          <span className="cal__t-corto" aria-hidden="true">
            {abreviar(etiqueta)}
          </span>
        </span>
      )}
    </button>
  )
}

export default Calendario
