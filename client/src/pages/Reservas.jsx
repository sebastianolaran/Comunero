import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import ConfirmDialog from '../components/ConfirmDialog'
import Intercambios from '../components/Intercambios'
import NuevaReservaModal from '../components/NuevaReservaModal'
import Pagination from '../components/Pagination'
import ProponerIntercambio from '../components/ProponerIntercambio'
import { Cargando, ErrorCarga, Vacio } from '../components/ui/Estado'
import FieldError from '../components/ui/FieldError'
import Filtros from '../components/ui/Filtros'
import { ChipsVoto } from '../components/ui/Votacion'
import { cancelUseReservation, fetchUseReservations, voteUseReservation } from '../lib/api'
import { assetIdActual } from '../lib/currentAsset'
import { userIdActual } from '../lib/currentUser'
import { fmtAprobaron } from '../lib/format'
import { usePaginacion } from '../lib/pagination'
import { daysLabel, formatRange, hoyLocal } from '../lib/rentalRequests'
import { ALCANCES, ESTADOS, filtrarReservas, porVotar, puedeCancelar, textoEstado, textoMotivo } from '../lib/reservas'
import { agruparIntercambios, puedeProponerIntercambio } from '../lib/swaps'
import { cancelSwap, fetchSwaps, respondSwap } from '../services/reservationSwap'
import './Reservas.css'

const fecha = (valor) => String(valor).slice(0, 10)
const rango = (reserva) => formatRange(fecha(reserva.startDate), fecha(reserva.endDate))

function descripcionPisada(otra) {
  const quien = otra.type === 'RENTAL' ? `el alquiler${otra.name ? ` de ${otra.name}` : ''}` : `el pedido de ${otra.name ?? 'otro integrante'}`
  return `${quien} (${rango(otra)})`
}
const dias = (reserva) => daysLabel(fecha(reserva.startDate), fecha(reserva.endDate))

const CLASE_ESTADO = { ACTIVE: 'tag tag--solid tag--si', PENDING: 'tag tag--dash', REJECTED: 'tag tag--no' }

function VerEnCalendario({ reserva }) {
  return (
    <Link className="btn btn--link" to="/calendario" state={{ fecha: fecha(reserva.startDate), reservaId: reserva.id }}>
      Ver en el calendario
    </Link>
  )
}

// Reservar, votar, cancelar e intercambiar turnos de uso propio. El
// Calendario solo muestra; todo lo que cambia algo pasa por acá.
function Reservas() {
  const assetId = assetIdActual()
  const userId = userIdActual()
  const location = useLocation()
  const navigate = useNavigate()

  const [tab, setTab] = useState(location.state?.tab ?? 'lista')
  const [nuevaAbierta, setNuevaAbierta] = useState(false)
  const [carga, setCarga] = useState({ estado: 'loading', reservas: [] })
  const [intercambios, setIntercambios] = useState({ lista: [], error: null })
  const [version, setVersion] = useState(0)
  const recargar = () => setVersion((n) => n + 1)

  const [cancelacion, setCancelacion] = useState(null)
  const [cancelando, setCancelando] = useState(false)
  const [errorCancelacion, setErrorCancelacion] = useState(null)
  const [turnoPedido, setTurnoPedido] = useState(null)
  const [respondiendo, setRespondiendo] = useState(false)

  // El state de la navegación ya se usó: sin limpiarlo, volver atrás repite la pestaña elegida.
  useEffect(() => {
    if (location.state) navigate('.', { replace: true, state: null })
  }, [location.state, navigate])

  useEffect(() => {
    if (!assetId) return
    const controller = new AbortController()
    fetchUseReservations(assetId, { signal: controller.signal })
      .then((reservas) => setCarga({ estado: 'ok', reservas }))
      .catch((err) => {
        if (err.name !== 'AbortError') setCarga((prev) => ({ ...prev, estado: 'error' }))
      })
    fetchSwaps(assetId, userId, { signal: controller.signal })
      .then((lista) => setIntercambios({ lista, error: null }))
      .catch((err) => {
        if (err.name !== 'AbortError') setIntercambios((prev) => ({ ...prev, error: 'No se pudieron cargar los intercambios.' }))
      })
    return () => controller.abort()
  }, [assetId, userId, version])

  if (!assetId) {
    return <Vacio panel titulo="La sesión no está activa.">Ingresar de nuevo para continuar.</Vacio>
  }

  const hoy = hoyLocal()
  const aVotar = porVotar(carga.reservas, userId, hoy)
  const { recibidos } = agruparIntercambios(intercambios.lista, userId)

  const cancelarTurno = async () => {
    if (!cancelacion || cancelando) return
    setCancelando(true)
    setErrorCancelacion(null)
    try {
      await cancelUseReservation(cancelacion.id, { userId })
      setCancelacion(null)
      recargar()
    } catch (err) {
      setErrorCancelacion(err.message)
    } finally {
      setCancelando(false)
    }
  }

  const accionIntercambio = async (accion) => {
    if (respondiendo) return
    setRespondiendo(true)
    setIntercambios((prev) => ({ ...prev, error: null }))
    try {
      await accion()
    } catch (err) {
      setIntercambios((prev) => ({ ...prev, error: err.message }))
    } finally {
      setRespondiendo(false)
      recargar()
    }
  }

  const TABS = [
    { id: 'lista', label: 'Reservas' },
    { id: 'votar', label: aVotar.length ? `Por votar · ${aVotar.length}` : 'Por votar' },
    { id: 'intercambios', label: recibidos.length ? `Intercambios · ${recibidos.length}` : 'Intercambios' },
  ]

  let contenido
  if (carga.estado === 'loading') {
    contenido = <Cargando filas={5}>Cargando reservas…</Cargando>
  } else if (carga.estado === 'error') {
    contenido = (
      <ErrorCarga
        titulo="No se pudieron cargar las reservas."
        onReintentar={() => {
          setCarga({ estado: 'loading', reservas: [] })
          recargar()
        }}
      />
    )
  } else if (tab === 'lista') {
    contenido = (
      <ListaReservas
        reservas={carga.reservas}
        userId={userId}
        hoy={hoy}
        onCancelar={(reserva) => {
          setErrorCancelacion(null)
          setCancelacion(reserva)
        }}
        onProponer={setTurnoPedido}
      />
    )
  } else if (tab === 'votar') {
    contenido = <PorVotar reservas={aVotar} userId={userId} onVotado={recargar} />
  } else {
    contenido = (
      <Intercambios
        swaps={intercambios.lista}
        userId={userId}
        error={intercambios.error}
        ocupado={respondiendo}
        onResponder={(swap, value) => accionIntercambio(() => respondSwap(swap.id, { userId, value }))}
        onRetirar={(swap) => accionIntercambio(() => cancelSwap(swap.id, { userId }))}
      />
    )
  }

  return (
    <section>
      <div className="res-bar">
        <div className="seg res-tabs" role="tablist" aria-label="Reservas">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={tab === id ? 'seg__b seg__b--on' : 'seg__b'}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn--primary" onClick={() => setNuevaAbierta(true)}>
          + Reservar
        </button>
      </div>

      {contenido}

      {nuevaAbierta && (
        <NuevaReservaModal
          assetId={assetId}
          userId={userId}
          onClose={() => setNuevaAbierta(false)}
          onCreada={() => {
            setNuevaAbierta(false)
            setTab('lista')
            recargar()
          }}
        />
      )}

      {cancelacion && (
        <ConfirmDialog
          title="Cancelar reserva"
          lines={['Se va a cancelar la reserva completa y todos sus días quedan libres.', `Rango: ${rango(cancelacion)}.`]}
          confirmLabel="Cancelar reserva"
          busyLabel="Cancelando…"
          busy={cancelando}
          error={errorCancelacion}
          onConfirm={cancelarTurno}
          onCancel={() => {
            if (!cancelando) setCancelacion(null)
          }}
        />
      )}

      {turnoPedido && (
        <ProponerIntercambio
          pedido={turnoPedido}
          userId={userId}
          onClose={() => setTurnoPedido(null)}
          onPropuesto={() => {
            setTurnoPedido(null)
            setTab('intercambios')
            recargar()
          }}
        />
      )}
    </section>
  )
}

function ListaReservas({ reservas, userId, hoy, onCancelar, onProponer }) {
  const [alcance, setAlcance] = useState('todas')
  const [estado, setEstado] = useState('todas')
  const visibles = filtrarReservas(reservas, { alcance, estado }, userId)
  const paginacion = usePaginacion(visibles, `${alcance}-${estado}`)

  return (
    <>
      <div className="res-filtros">
        <Filtros opciones={ALCANCES} valor={alcance} onChange={setAlcance} etiqueta="De quién" />
        <Filtros opciones={ESTADOS} valor={estado} onChange={setEstado} etiqueta="Estado" />
      </div>

      {visibles.length === 0 ? (
        <Vacio panel titulo={reservas.length === 0 ? 'Todavía no hay reservas.' : 'No hay reservas con estos filtros.'}>
          {reservas.length === 0 && 'Con "+ Reservar" se pide un turno de uso propio; los demás lo votan.'}
        </Vacio>
      ) : (
        <div className="card card--flush tabla-wrap">
          <table className="tabla">
            <caption className="solo-lector">Reservas de uso propio</caption>
            <thead>
              <tr className="tbl__h">
                <th scope="col">Fechas</th>
                <th scope="col">Quién</th>
                <th scope="col">Días</th>
                <th scope="col">Votos</th>
                <th scope="col">Estado</th>
                <th scope="col">
                  <span className="solo-lector">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paginacion.elementos.map((reserva) => {
                const propia = reserva.userId === userId
                const motivo = reserva.status === 'REJECTED' ? textoMotivo(reserva) : null
                return (
                  <tr key={reserva.id} className="tbl__r">
                    <td className="res-fechas">{rango(reserva)}</td>
                    <th scope="row" className="tabla__nombre">
                      <span className="res-quien">
                        {reserva.user?.name ?? 'Integrante'}
                        {propia && alcance === 'todas' && <span className="tag tag--solid">Propia</span>}
                      </span>
                      {motivo && <span className="res-motivo">{motivo}</span>}
                    </th>
                    <td className="tabla__suave">{dias(reserva)}</td>
                    <td className="tabla__suave">
                      {reserva.approvalCount}/{reserva.coownerCount}
                    </td>
                    <td>
                      <span className={CLASE_ESTADO[reserva.status]}>{textoEstado(reserva)}</span>
                    </td>
                    <td className="res-acciones">
                      {puedeCancelar(reserva, userId, hoy) && (
                        <button type="button" className="btn btn--sm" onClick={() => onCancelar(reserva)}>
                          Cancelar
                        </button>
                      )}
                      {puedeProponerIntercambio(reserva, userId, hoy) && (
                        <button type="button" className="btn btn--sm" onClick={() => onProponer(reserva)}>
                          Proponer intercambio
                        </button>
                      )}
                      {reserva.status !== 'REJECTED' && <VerEnCalendario reserva={reserva} />}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <Pagination {...paginacion} />
        </div>
      )}
    </>
  )
}

function PorVotar({ reservas, userId, onVotado }) {
  const paginacion = usePaginacion(reservas)

  if (reservas.length === 0) {
    return (
      <Vacio panel titulo="No hay reservas esperando el voto propio.">
        Cuando otro integrante pide un turno, aparece acá para aprobarlo o rechazarlo.
      </Vacio>
    )
  }

  return (
    <>
      <p className="hint res-regla">
        Se aprueba cuando votan Sí todos los copropietarios; un No la rechaza.
      </p>
      <ul className="res-votar" role="list">
        {paginacion.elementos.map((reserva) => (
          <VotoReserva key={reserva.id} reserva={reserva} userId={userId} onVotado={onVotado} />
        ))}
      </ul>
      <Pagination {...paginacion} />
    </>
  )
}

function VotoReserva({ reserva, userId, onVotado }) {
  const [rechazando, setRechazando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [envio, setEnvio] = useState({ enviando: false, error: null })

  const votar = async (value) => {
    setEnvio({ enviando: true, error: null })
    try {
      await voteUseReservation(reserva.id, { userId, value, reason: value === 'REJECT' ? motivo : undefined })
      onVotado()
    } catch (err) {
      setEnvio({ enviando: false, error: err.message })
      // Si ya se cerró mientras tanto, la recarga la saca de la lista.
      onVotado()
    }
  }

  return (
    <li className="card card--pad res-voto">
      <div className="res-voto__cab">
        <strong>{reserva.user?.name ?? 'Integrante'}</strong>
        <span className="meta">{fmtAprobaron(reserva.approvalCount, reserva.coownerCount)}</span>
      </div>
      <p className="meta">
        {rango(reserva)} · {dias(reserva)}
      </p>
      <ChipsVoto votes={reserva.votes} />
      {reserva.overlapsWith?.length > 0 && (
        <p className="res-voto__pisa">
          Se pisa con {reserva.overlapsWith.map(descripcionPisada).join(' y ')}: si se aprueba este, {reserva.overlapsWith.length === 1 ? 'ese se rechaza solo' : 'esos se rechazan solos'}.
        </p>
      )}
      <FieldError>{envio.error}</FieldError>
      {rechazando ? (
        <div className="res-voto__rechazo">
          <label className="lbl">
            Motivo del rechazo (opcional)
            <textarea className="ta" rows={2} maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </label>
          <div className="res-voto__acciones">
            <button type="button" className="btn btn--sm" disabled={envio.enviando} onClick={() => setRechazando(false)}>
              Volver
            </button>
            <button type="button" className="btn btn--sm btn--primary" disabled={envio.enviando} onClick={() => votar('REJECT')}>
              {envio.enviando ? 'Enviando…' : 'Confirmar rechazo'}
            </button>
          </div>
        </div>
      ) : (
        <div className="res-voto__acciones">
          <button type="button" className="btn btn--sm btn--primary" disabled={envio.enviando} onClick={() => votar('APPROVE')}>
            Aprobar
          </button>
          <button type="button" className="btn btn--sm" disabled={envio.enviando} onClick={() => setRechazando(true)}>
            Rechazar
          </button>
          <VerEnCalendario reserva={reserva} />
        </div>
      )}
    </li>
  )
}

export default Reservas
