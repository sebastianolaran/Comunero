import { useEffect, useState } from 'react'
import { createReservation, fetchPendingUseReservations, fetchReservations, voteUseReservation } from '../lib/api'
import { assetIdActual } from '../lib/currentAsset'
import { userIdActual } from '../lib/currentUser'
import { daysLabel, formatRange } from '../lib/rentalRequests'
import { updateRentalTask } from '../services/rentalPreparation'
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

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const formateadorDetalle = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
})

function fechaDetalle(dia) {
  return formateadorDetalle.format(dia)
}

function fechaInput(dia) {
  return dia.toISOString().slice(0, 10)
}

function etiquetaReserva(dia) {
  return `Reservar ${dia.getUTCDate()} de ${MESES_CORTOS[dia.getUTCMonth()]}`
}

function fechaSolo(valor) {
  return typeof valor === 'string' ? valor.slice(0, 10) : valor
}

function rangoPeticion(peticion) {
  return {
    desde: fechaSolo(peticion.startDate),
    hasta: fechaSolo(peticion.endDate),
  }
}

function leerPrevisualizacion(assetId) {
  try {
    const guardada = globalThis.localStorage?.getItem(`comunero.calendario.peticion.${assetId}`)
    if (!guardada) return null
    const peticion = JSON.parse(guardada)
    return typeof peticion === 'object' ? peticion : { id: peticion }
  } catch {
    return null
  }
}

function Calendario() {
  // Quién entró y a qué bien: el router ya garantiza que hay sesión, pero se
  // resuelve acá y no al importar el módulo para que valga la de ahora.
  const assetId = assetIdActual()
  const userId = userIdActual()

  const [year, setYear] = useState(HOY.getUTCFullYear())
  const [month, setMonth] = useState(HOY.getUTCMonth() + 1)
  const [reservas, setReservas] = useState([])
  const [peticionesPendientes, setPeticionesPendientes] = useState([])
  const [estadoCarga, setEstadoCarga] = useState('loading') // loading | ok | error
  const [diaSeleccionado, setDiaSeleccionado] = useState(null)
  const [peticionVisible, setPeticionVisible] = useState(() => leerPrevisualizacion(assetId))
  const [tareasGuardando, setTareasGuardando] = useState([])
  const [errorTarea, setErrorTarea] = useState(null)
  const [errorVoto, setErrorVoto] = useState(null)
  const [errorPendientes, setErrorPendientes] = useState(null)
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
          setPeticionVisible((actual) => {
            if (!actual) return null
            const peticion = reservations.find((reserva) => reserva.id === actual.id)
            return peticion && peticion.status === 'PENDING' ? peticion : peticion ? null : actual
          })
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

  useEffect(() => {
    if (!assetId) return
    const controller = new AbortController()
    let vivo = true

    fetchPendingUseReservations(assetId, { signal: controller.signal })
      .then((pending) => {
        if (vivo) {
          setPeticionesPendientes([...pending].sort((a, b) => a.startDate.localeCompare(b.startDate)))
          setErrorPendientes(null)
        }
      })
      .catch((err) => {
        if (vivo && err.name !== 'AbortError') setErrorPendientes('No se pudieron cargar las peticiones pendientes.')
      })

    return () => {
      vivo = false
      controller.abort()
    }
  }, [assetId, refreshKey])

  useEffect(() => {
    try {
      const clave = `comunero.calendario.peticion.${assetId}`
      if (peticionVisible) globalThis.localStorage?.setItem(clave, JSON.stringify(peticionVisible))
      else globalThis.localStorage?.removeItem(clave)
    } catch {
      // Sin storage, la previsualizacion dura mientras siga montada la pantalla.
    }
  }, [assetId, peticionVisible])

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

  const seleccionarDia = (dia) => {
    setErrorTarea(null)
    setDiaSeleccionado(dia.toISOString())
    const fecha = fechaInput(dia)
    setForm({ inicio: fecha, fin: fecha })
    setFormAbierto(false)
    setFormError(null)
  }

  const seleccionarPeticion = (peticion) => {
    setErrorVoto(null)
    setPeticionVisible(peticion)
    setDiaSeleccionado(null)
    setFormAbierto(false)
  }

  const quitarPrevisualizacion = () => {
    setErrorVoto(null)
    setPeticionVisible(null)
  }

  const votarPeticion = async (peticion, value) => {
    setErrorVoto(null)
    try {
      await voteUseReservation(peticion.id, { userId, value })
      setPeticionVisible(null)
      setRefreshKey((key) => key + 1)
    } catch (err) {
      setErrorVoto(err.message)
    }
  }

  const cambiarTarea = async (reservationId, tareaId, completed) => {
    if (tareasGuardando.includes(tareaId)) return

    setErrorTarea(null)
    setTareasGuardando((ids) => [...ids, tareaId])
    try {
      const tareaActualizada = await updateRentalTask(tareaId, { completed })
      setReservas((actuales) =>
        actuales.map((reserva) => {
          if (reserva.id !== reservationId) return reserva
          return {
            ...reserva,
            tasks: reserva.tasks.map((tarea) => (tarea.id === tareaId ? tareaActualizada : tarea)),
          }
        }),
      )
    } catch (err) {
      setErrorTarea(err.mensajes?.join('. ') ?? 'No se pudo actualizar la tarea.')
    } finally {
      setTareasGuardando((ids) => ids.filter((id) => id !== tareaId))
    }
  }

  const irMesAnterior = () => {
    const { year: y, month: m } = mesAnterior(year, month)
    setEstadoCarga('loading')
    setDiaSeleccionado(null)
    setYear(y)
    setMonth(m)
  }

  const irMesSiguiente = () => {
    const { year: y, month: m } = mesSiguiente(year, month)
    setEstadoCarga('loading')
    setDiaSeleccionado(null)
    setYear(y)
    setMonth(m)
  }

  if (!assetId) {
    return <p className="panel empty">No encontramos tu sesión. Volvé a entrar.</p>
  }

  const dias = diasDelMes(year, month)
  const espaciosVacios = primerDiaSemana(year, month)
  const espaciosFinales = (7 - ((espaciosVacios + dias.length) % 7)) % 7
  const peticionVisibleId = peticionVisible?.id ?? null
  const peticionVisibleActual = peticionesPendientes.find((peticion) => peticion.id === peticionVisibleId)
    ?? (peticionVisible?.startDate ? peticionVisible : null)
  const integrantes = integrantesEnReservas(reservas, peticionVisibleId)

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

        {peticionVisibleActual && (
          <AvisoPeticionPendiente peticion={peticionVisibleActual} onClear={quitarPrevisualizacion} />
        )}

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
            <Dia
              key={dia.toISOString()}
              dia={dia}
              info={estadoDelDia(dia, reservas, peticionVisibleId)}
              seleccionado={diaSeleccionado === dia.toISOString()}
              onSelect={() => seleccionarDia(dia)}
            />
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
        <DetalleDia
          dia={diaSeleccionado ? new Date(diaSeleccionado) : null}
          reservas={reservas}
          userId={userId}
          tareasGuardando={tareasGuardando}
          errorTarea={errorTarea}
          onTareaChange={cambiarTarea}
        />
        <div className="panel">
          {!formAbierto && (
            <button
              type="button"
              className="btn btn--block btn--primary"
              title="Reservar días para uso propio. Los alquileres a terceros se cargan en Alquiler."
              onClick={() => setFormAbierto(true)}
            >
              {diaSeleccionado ? etiquetaReserva(new Date(diaSeleccionado)) : 'Reservar'}
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

        {peticionesPendientes.length > 0 && (
          <PeticionesPendientes
            peticiones={peticionesPendientes}
            peticionVisibleId={peticionVisibleId}
            userId={userId}
            error={errorVoto ?? errorPendientes}
            onSelect={seleccionarPeticion}
            onVote={votarPeticion}
          />
        )}
      </aside>
    </div>
  )
}

function AvisoPeticionPendiente({ peticion, onClear }) {
  const { desde, hasta } = rangoPeticion(peticion)
  const nombre = peticion.user?.name ?? 'Integrante'

  return (
    <div className="cal-preview" aria-live="polite">
      <p className="cal-preview__text">
        Pedido pendiente de {nombre}: {formatRange(desde, hasta)}. Todavía no está aprobado, por eso no queda fijo en el calendario.
      </p>
      <button type="button" className="btn btn--link cal-preview__action" onClick={onClear}>
        Quitar
      </button>
    </div>
  )
}

function PeticionesPendientes({ peticiones, peticionVisibleId, userId, error, onSelect, onVote }) {
  return (
    <section className="panel cal-pending" aria-label="Peticiones pendientes de votación">
      <header className="cal-pending__head">
        <h2 className="cal-pending__t">Por votar ({peticiones.length})</h2>
        <button type="button" className="btn btn--link" disabled title="Disponible cuando exista la pestaña Reservas">
          Ver en reservas
        </button>
      </header>
      <p className="hint cal-pending__hint">Pendiente de los demás. Tocá una para verla en el calendario.</p>
      {error && <p className="cal-form__err" role="alert">{error}</p>}
      <ul className="cal-pending__list" role="list">
        {peticiones.map((peticion) => {
          const propia = peticion.userId === userId
          const votos = Math.max(0, (peticion.approvalCount ?? 0) - 1)
          const total = Math.max(0, (peticion.coownerCount ?? 0) - 1)
          const { desde, hasta } = rangoPeticion(peticion)
          const nombre = peticion.user?.name ?? 'Integrante'

          return (
            <li key={peticion.id} className={peticion.id === peticionVisibleId ? 'cal-pending__item cal-pending__item--on' : 'cal-pending__item'}>
              <button type="button" className="cal-pending__select" onClick={() => onSelect(peticion)}>
                <span className="cal-pending__title">
                  <strong>{nombre}{propia && ' (Tú)'}</strong>
                  <span>{votos}/{total} votos</span>
                </span>
                <span>{peticion.type === 'RENTAL' ? 'Alquiler' : 'Uso propio'}</span>
                <span>{formatRange(desde, hasta)} · {daysLabel(desde, hasta)}</span>
              </button>
              {!propia && (
                <div className="cal-pending__actions">
                  <button type="button" className="btn btn--sm btn--primary" onClick={() => onVote(peticion, 'APPROVE')}>
                    Aceptar
                  </button>
                  <button type="button" className="btn btn--sm" onClick={() => onVote(peticion, 'REJECT')}>
                    Rechazar
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function DetalleDia({ dia, reservas, userId, tareasGuardando, errorTarea, onTareaChange }) {
  const info = dia ? estadoDelDia(dia, reservas) : null
  let descripcion = 'Elegí un día del calendario para ver su detalle.'

  if (dia && info.estado === 'libre') {
    descripcion = 'Día disponible para ser reservado.'
  } else if (dia && info.estado === 'reservado') {
    if (info.pendiente) {
      descripcion = info.userId === userId
        ? 'Tu turno está pendiente de confirmación.'
        : `Turno pendiente de ${info.userName ?? 'un integrante'}.`
    } else {
      descripcion = info.userId === userId
        ? 'Tu turno está confirmado.'
        : `Turno confirmado de ${info.userName ?? 'un integrante'}.`
    }
  } else if (dia && info.estado === 'alquilado') {
    return (
      <DetalleAlquiler
        dia={dia}
        alquiler={info.alquiler}
        tareasGuardando={tareasGuardando}
        errorTarea={errorTarea}
        onTareaChange={onTareaChange}
      />
    )
  } else if (dia && info.estado === 'rechazado') {
    descripcion = 'Turno rechazado.'
  }

  return (
    <div className="panel cal-detail" aria-live="polite">
      {dia && <h2 className="cal-detail__t">{fechaDetalle(dia)}</h2>}
      <p className="cal-detail__d">{descripcion}</p>
    </div>
  )
}

function DetalleAlquiler({ dia, alquiler, tareasGuardando, errorTarea, onTareaChange }) {
  const tareas = alquiler.tasks ?? []
  const pendientes = tareas.filter((tarea) => !tarea.completed).length
  const monto = alquiler.amount == null ? null : `$${alquiler.amount.toLocaleString('es-AR')}`

  return (
    <div className="panel cal-detail" aria-live="polite">
      <h2 className="cal-detail__t">{fechaDetalle(dia)}</h2>
      <p className="cal-detail__d">
        Alquilado a {alquiler.renter?.name ?? 'un huésped'}
        {alquiler.renter?.phone && ` · Tel: ${alquiler.renter.phone}`}
        {monto && ` · Monto total: ${monto}`}
      </p>
      <p className="cal-detail__managed">Gestionado por {alquiler.user?.name ?? 'un copropietario'}</p>

      <h3 className="cal-detail__sect">Tareas de preparación · {pendientes} pendientes</h3>
      {errorTarea && (
        <p className="cal-detail__error" role="alert">
          {errorTarea}
        </p>
      )}
      {tareas.length === 0 ? (
        <p className="cal-detail__empty">No hay tareas de preparación.</p>
      ) : (
        <ul className="cal-detail__tasks" role="list">
          {tareas.map((tarea) => (
            <li key={tarea.id} className="cal-detail__task">
              <label className="cal-detail__task-name">
                <input
                  type="checkbox"
                  checked={tarea.completed}
                  disabled={tareasGuardando.includes(tarea.id)}
                  onChange={(event) => onTareaChange(alquiler.id, tarea.id, event.target.checked)}
                />
                <span className={tarea.completed ? 'task__t task__t--done' : 'task__t'}>{tarea.name}</span>
              </label>
              <span className="meta">{tarea.assignedTo?.name ?? 'Sin responsable'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Una celda del mes. Uso propio: tinte del tono del integrante (punteado si
// está pendiente) con sus iniciales; alquiler y rechazo tienen su propio estilo.
function Dia({ dia, info, seleccionado, onSelect }) {
  const { estado } = info
  const clases = ['cal__c', `cal__c--${estado}`]
  if (seleccionado) clases.push('cal__c--on')
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
    <button
      type="button"
      className={clases.join(' ')}
      style={estilo}
      title={titulo}
      aria-label={`${fechaDetalle(dia)}. ${titulo}`}
      aria-pressed={seleccionado}
      onClick={onSelect}
    >
      <span className="cal__n">{dia.getUTCDate()}</span>
      {etiqueta && <span className="cal__t">{etiqueta}</span>}
    </button>
  )
}

export default Calendario
