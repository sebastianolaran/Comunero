import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { createReservation, fetchReservations } from '../lib/api'
import { assetIdActual } from '../lib/currentAsset'
import { userIdActual } from '../lib/currentUser'
import ExportarCalendario from '../components/ExportarCalendario'
import { Cargando, ErrorCarga, Vacio } from '../components/ui/Estado'
import FieldError from '../components/ui/FieldError'
import { fetchSettings } from '../services/settings'
import { formatRange, hoyLocal } from '../lib/rentalRequests'
import {
  colorDeIntegrante,
  DIAS_SEMANA,
  diaAprobado,
  diasDelMes,
  estadoDelDia,
  integrantesEnReservas,
  mesAnterior,
  mesSiguiente,
  nombreMes,
  primerDiaSemana,
  rangoOcupado,
  tonoDeIntegrante,
  turnoDemasiadoLargo,
} from '../lib/calendar'
import './Calendario.css'

const HOY = new Date()

const ETIQUETA_ESTADO = {
  libre: 'Libre',
  reservado: 'Reservado',
  alquilado: 'Alquilado',
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

const FORM_INICIAL = { inicio: '', fin: '' }

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function fechaInput(dia) {
  return dia.toISOString().slice(0, 10)
}

// Con el formulario abierto, la grilla arma el rango: un clic empieza, el
// siguiente lo cierra (en cualquier orden) y Shift+clic estira desde el inicio.
function rangoAlElegir(previo, fecha, extender) {
  const empezado = previo.inicio && fecha !== previo.inicio
  if (!empezado || (!extender && previo.inicio !== previo.fin)) return { inicio: fecha, fin: fecha }
  return previo.inicio < fecha ? { inicio: previo.inicio, fin: fecha } : { inicio: fecha, fin: previo.inicio }
}

const ERROR_OCUPADO = 'El rango incluye días ya aprobados: elegir días libres seguidos.'

// Solo lo aprobado ocupa el día: un pendiente todavía se vota.
function sePuedeReservar(dia, reservas) {
  return fechaInput(dia) >= hoyLocal() && !diaAprobado(dia, reservas)
}

function clasePendiente(reserva, userId) {
  const clases = ['cal__p']
  if (reserva.type === 'RENTAL') clases.push('cal__p--alquiler')
  if (reserva.type === 'USE' && reserva.userId === userId) clases.push('cal__p--propio')
  return clases.join(' ')
}

function tonoPendiente(reserva) {
  return reserva.type === 'RENTAL' ? undefined : { '--h': tonoDeIntegrante(reserva.userId, reserva.userHue) }
}

function etiquetaReserva(dia) {
  return `Reservar ${dia.getUTCDate()} de ${MESES_CORTOS[dia.getUTCMonth()]}`
}

function fechaSolo(valor) {
  return typeof valor === 'string' ? valor.slice(0, 10) : valor
}

function nombreDePendiente(reserva) {
  if (reserva.type === 'RENTAL') return reserva.renter?.name ? `Alquiler · ${reserva.renter.name}` : 'Alquiler'
  return reserva.user?.name ?? 'Un integrante'
}

// Para mirar y reservar: votar, cancelar e intercambiar se hace en Reservas.
// Desde ahí "Ver en el calendario" llega con { fecha, reservaId }: abre ese
// mes con el día elegido y, si está pendiente, la marca en la grilla.
function Calendario() {
  const assetId = assetIdActual()
  const userId = userIdActual()
  const destino = useLocation().state
  const [anioDestino, mesDestino] = destino?.fecha ? destino.fecha.split('-').map(Number) : []

  const [year, setYear] = useState(anioDestino ?? HOY.getUTCFullYear())
  const [month, setMonth] = useState(mesDestino ?? HOY.getUTCMonth() + 1)
  const [reservas, setReservas] = useState([])
  const [estadoCarga, setEstadoCarga] = useState('loading') // loading | ok | error
  const [intento, setIntento] = useState(0)
  const [diaSeleccionado, setDiaSeleccionado] = useState(destino?.fecha ? `${destino.fecha}T00:00:00.000Z` : null)
  const destacadaId = destino?.reservaId ?? null
  // Se incrementa después de crear una reserva, para que el mes la muestre.
  const [refreshKey, setRefreshKey] = useState(0)

  // El formulario vive en la columna lateral, oculto hasta que se toca "Reservar".
  const [formAbierto, setFormAbierto] = useState(false)
  const [form, setForm] = useState(FORM_INICIAL)
  const [formError, setFormError] = useState(null)
  const [enviando, setEnviando] = useState(false)
  // Máximo de días seguidos de Configuración. Si no se puede traer, valida el server igual.
  const [maximoDias, setMaximoDias] = useState(null)
  // Día bajo el mouse mientras se espera el segundo clic: pinta el rango que quedaría.
  const [diaBajoMouse, setDiaBajoMouse] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchSettings(assetId, userId, { signal: controller.signal })
      .then((settings) => setMaximoDias(settings.maxConsecutiveDays))
      .catch(() => setMaximoDias(null))
    return () => controller.abort()
  }, [assetId, userId])

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
  }, [assetId, year, month, intento, refreshKey])

  const setCampo = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }))

  // Las validaciones de fechas las hace el backend; acá solo se muestra el error que devuelva.
  const handleSolicitar = async (e) => {
    e.preventDefault()
    const demasiadoLargo = turnoDemasiadoLargo(form.inicio, form.fin, maximoDias)
    if (demasiadoLargo) return setFormError(demasiadoLargo)
    // Solo ve el mes cargado; si el rango sigue en otro mes, lo frena el server.
    if (rangoOcupado(form.inicio, form.fin, reservas)) return setFormError(ERROR_OCUPADO)
    if (form.inicio < hoyLocal()) return setFormError('No se puede reservar un día que ya pasó.')
    setFormError(null)
    setEnviando(true)
    try {
      await createReservation({ assetId, userId, startDate: form.inicio, endDate: form.fin })
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

  const seleccionarDia = (dia, extender = false) => {
    setDiaSeleccionado(dia.toISOString())
    setFormError(null)
    const fecha = fechaInput(dia)
    const libre = sePuedeReservar(dia, reservas)
    if (formAbierto) {
      // Otro clic en el día elegido lo desmarca: vuelven a habilitarse todos.
      if (fecha === form.inicio && form.inicio === form.fin) return setForm(FORM_INICIAL)
      const rango = rangoAlElegir(form, fecha, extender)
      // Con Shift se puede estirar un rango ya armado por encima de una reserva:
      // queda el rango anterior.
      if (rangoOcupado(rango.inicio, rango.fin, reservas)) return setFormError(ERROR_OCUPADO)
      setForm(rango)
      return
    }
    // Un día ocupado no se ofrece para reservar: el formulario arranca vacío.
    setForm(libre ? { inicio: fecha, fin: fecha } : FORM_INICIAL)
  }

  // Esc desmarca lo elegido sin cerrar el formulario.
  useEffect(() => {
    if (!formAbierto || !form.inicio) return
    const alApretar = (e) => {
      if (e.key !== 'Escape') return
      setForm(FORM_INICIAL)
      setFormError(null)
    }
    window.addEventListener('keydown', alApretar)
    return () => window.removeEventListener('keydown', alApretar)
  }, [formAbierto, form.inicio])

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
  // Con el formulario abierto, los días ocupados no se pueden tocar. Elegido el
  // primer día, tampoco los que cerrarían un rango por encima de otra reserva o
  // más largo que el máximo.
  const esperandoFin = formAbierto && Boolean(form.inicio) && form.inicio === form.fin
  const fueraDeAlcance = (dia) => {
    if (!esperandoFin) return false
    const fecha = fechaInput(dia)
    const [desde, hasta] = fecha < form.inicio ? [fecha, form.inicio] : [form.inicio, fecha]
    return rangoOcupado(desde, hasta, reservas) || Boolean(turnoDemasiadoLargo(desde, hasta, maximoDias))
  }
  const motivoBloqueo = (dia) => {
    if (!formAbierto) return null
    if (fechaInput(dia) < hoyLocal()) return 'pasado'
    if (diaAprobado(dia, reservas)) return 'ocupado'
    return fueraDeAlcance(dia) ? 'alcance' : null
  }
  const finVisible =
    esperandoFin && diaBajoMouse && !motivoBloqueo(new Date(`${diaBajoMouse}T00:00:00.000Z`)) ? diaBajoMouse : form.fin
  const enRango = (dia) => {
    if (!formAbierto || !form.inicio) return false
    const fecha = fechaInput(dia)
    const [desde, hasta] = finVisible < form.inicio ? [finVisible, form.inicio] : [form.inicio, finVisible || form.inicio]
    return fecha >= desde && fecha <= hasta
  }
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

        <div className="cal" aria-busy={estadoCarga === 'loading'} onMouseLeave={() => setDiaBajoMouse(null)}>
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
              bloqueo={motivoBloqueo(dia)}
              enRango={enRango(dia)}
              userId={userId}
              onHover={() => setDiaBajoMouse(fechaInput(dia))}
              onSelect={(extender) => seleccionarDia(dia, extender)}
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
        </ul>
      </section>

      <aside className="rail cal-rail">
        <DetalleDia dia={diaSeleccionado ? new Date(diaSeleccionado) : null} reservas={reservas} destacadaId={destacadaId} />
        <div className="panel">
          {!formAbierto && (
            <>
              <button
                type="button"
                className="btn btn--block btn--primary"
                title="Reservar días para uso propio. Los alquileres a terceros se cargan en Alquiler."
                onClick={() => setFormAbierto(true)}
              >
                {diaSeleccionado && sePuedeReservar(new Date(diaSeleccionado), reservas)
                  ? etiquetaReserva(new Date(diaSeleccionado))
                  : 'Reservar'}
              </button>
              <p className="hint cal-rail__hint">Votar, cancelar e intercambiar turnos se hace en Reservas.</p>
            </>
          )}

          {formAbierto && (
            <form onSubmit={handleSolicitar}>
              <h2 className="cal-form__t">Nueva reserva</h2>
              <p className="hint cal-form__hint">
                Reserva de uso propio. Para alquilar a un tercero está la sección Alquiler. En el calendario, un
                clic marca el primer día y otro el último; otro clic en el mismo día (o Esc) lo desmarca, y Shift+clic estira el rango.
                {maximoDias != null && ` Hasta ${maximoDias === 1 ? '1 día' : `${maximoDias} días seguidos`}.`}
              </p>

              <div className="cal-form__fechas">
                <label className="lbl">
                  Desde
                  <input className="in" type="date" value={form.inicio} onChange={setCampo('inicio')} required />
                </label>
                <label className="lbl">
                  Hasta
                  <input className="in" type="date" value={form.fin} onChange={setCampo('fin')} required />
                </label>
              </div>

              <FieldError>{formError}</FieldError>

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
        <ExportarCalendario assetId={assetId} userId={userId} />
      </aside>
    </div>
  )
}

function DetalleDia({ dia, reservas, destacadaId }) {
  const info = dia ? estadoDelDia(dia, reservas, destacadaId) : null
  let descripcion = 'Elegir un día del calendario para ver su detalle.'

  if (dia && info.pendientes?.length > 1) {
    return (
      <div className="panel cal-detail" aria-live="polite">
        <h2 className="cal-detail__t">{fechaDetalle(dia)}</h2>
        <p className="cal-detail__d">
          {info.pendientes.length} pedidos pendientes que se pisan. Si se aprueba uno, los demás se rechazan solos.
        </p>
        <ul className="cal-detail__pend" role="list">
          {info.pendientes.map((reserva) => (
            <li key={reserva.id}>
              {nombreDePendiente(reserva)} · {formatRange(fechaSolo(reserva.startDate), fechaSolo(reserva.endDate))}
            </li>
          ))}
        </ul>
        <Link className="btn btn--link" to="/reservas" state={{ tab: 'votar' }}>
          Votar en Reservas
        </Link>
      </div>
    )
  }

  if (dia && info.estado === 'libre') {
    descripcion = 'Día disponible para ser reservado.'
  } else if (dia && info.estado === 'reservado') {
    const nombre = info.userName ?? 'un integrante'
    descripcion = info.pendiente ? `Reserva pendiente de ${nombre}.` : `Reserva confirmada de ${nombre}.`
  } else if (dia && info.estado === 'alquilado') {
    return <DetalleAlquiler dia={dia} alquiler={info.alquiler} />
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

const ABREVIATURAS = { Alquiler: 'Alq.' }
const abreviar = (etiqueta) => ABREVIATURAS[etiqueta] ?? etiqueta.slice(0, 2)

const TITULO_BLOQUEO = {
  pasado: 'No se puede elegir: ya pasó',
  alcance: 'No se puede elegir: el rango pasaría por otra reserva o superaría el máximo de días',
}

// Una celda del mes. Uso propio: tinte del tono del integrante (punteado si
// está pendiente); con varios pendientes, un renglón por pedido o sus iniciales.
function Dia({ dia, info, seleccionado, hoy, pasado, cargando, enRango, bloqueo, userId, onHover, onSelect }) {
  const { estado } = info
  const varios = info.pendientes?.length > 1
  const bloqueado = Boolean(bloqueo)
  const clases = ['cal__c', varios ? 'cal__c--varios' : `cal__c--${estado}`]
  if (seleccionado) clases.push('cal__c--on')
  if (hoy) clases.push('cal__c--hoy')
  if (pasado) clases.push('cal__c--pasado')
  if (enRango) clases.push('cal__c--rango')
  // Fuera de alcance va tachado; lo ocupado o pasado solo se atenúa, ya tiene su color.
  if (bloqueo === 'alcance') clases.push('cal__c--bloqueado')
  else if (bloqueado) clases.push('cal__c--inactivo')
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
  }

  const sufijo = info.pendiente ? ' (pendiente)' : ''
  const nombresPendientes = varios ? info.pendientes.map(nombreDePendiente).join(', ') : ''
  // Mientras carga, la grilla vacía no tiene que anunciar "Libre".
  const titulo = cargando
    ? 'Cargando'
    : bloqueo === 'ocupado'
    ? `No se puede elegir: ${ETIQUETA_ESTADO[estado].toLowerCase()}`
    : bloqueado
    ? TITULO_BLOQUEO[bloqueo]
    : varios
    ? `${info.pendientes.length} pendientes: ${nombresPendientes}`
    : info.userName
    ? `${ETIQUETA_ESTADO[estado]}: ${info.userName}${sufijo}`
    : `${ETIQUETA_ESTADO[estado]}${sufijo}`

  return (
    <button
      type="button"
      className={clases.join(' ')}
      style={estilo}
      title={titulo}
      aria-label={`${hoy ? 'Hoy, ' : ''}${fechaDetalle(dia)}. ${titulo}${enRango ? '. En el rango a reservar' : ''}`}
      aria-pressed={seleccionado}
      aria-current={hoy ? 'date' : undefined}
      disabled={bloqueado}
      onMouseEnter={onHover}
      onClick={(e) => onSelect(e.shiftKey)}
    >
      <span className="cal__n">
        {dia.getUTCDate()}
        {hoy && <span className="cal__hoy">Hoy</span>}
      </span>
      {varios && info.pendientes.length === 2 && (
        <span className="cal__ps">
          {info.pendientes.map((reserva) => (
            <span key={reserva.id} className={clasePendiente(reserva, userId)} style={tonoPendiente(reserva)}>
              <span className="cal__t-largo">{nombreDePendiente(reserva)}</span>
              <span className="cal__t-corto" aria-hidden="true">
                {abreviar(nombreDePendiente(reserva))}
              </span>
            </span>
          ))}
        </span>
      )}
      {/* Con 3 o más, las iniciales en un renglón: la celda no crece y los nombres completos están en el detalle. */}
      {info.pendientes?.length > 2 && (
        <span className="cal__ini" aria-hidden="true">
          {info.pendientes.slice(0, 3).map((reserva) => (
            <span key={reserva.id} className={`${clasePendiente(reserva, userId)} cal__p--ini`} style={tonoPendiente(reserva)}>
              {reserva.type === 'RENTAL' ? 'Alq' : (reserva.user?.name ?? '?').slice(0, 2)}
            </span>
          ))}
          {info.pendientes.length > 3 && <span className="cal__ini-mas">+{info.pendientes.length - 3}</span>}
        </span>
      )}
      {!varios && etiqueta && (
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
