import { useEffect, useId, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import RentalRequestCard from '../components/RentalRequestCard'
import NewRentalRequestModal from '../components/NewRentalRequestModal'
import RentalRequestDetail from '../components/RentalRequestDetail'
import { assetIdActual } from '../lib/currentAsset'
import { userIdActual } from '../lib/currentUser'
import { agrupar, validarVoto } from '../lib/rentalRequests'
import { useDetalleEnMobile } from '../lib/useDetalleEnMobile'
import {
  cancelRental,
  createRentalRequest,
  fetchRentalRequests,
  markRentalPaid,
  voteRentalRequest,
} from '../services/rentalRequest'

const ACCIONES = { pagar: markRentalPaid, cancelar: cancelRental }

function RentalRequests({ assetId = assetIdActual(), userId = userIdActual() }) {
  const [carga, setCarga] = useState({ estado: 'loading', solicitudes: [] })
  const [intento, setIntento] = useState(0)
  const [seleccion, setSeleccion] = useState(null)
  const [modo, setModo] = useState('ver')
  const [envio, setEnvio] = useState({ enviando: false, error: null })
  const location = useLocation()
  const navigate = useNavigate()
  // El alta se abre con este state: lo mandan "+ Nueva solicitud" de la barra de
  // Alquiler y el historial de inquilinos (con nombre y teléfono para precargar).
  // Si la página ya estaba montada, el state llega en una navegación nueva
  // (otro location.key) y se atiende durante el render.
  const pedida = location.state?.nuevaSolicitud
  const [precarga, setPrecarga] = useState(() => pedida ?? null)
  const [nuevaAbierta, setNuevaAbierta] = useState(() => Boolean(pedida))
  const [pedidoAtendido, setPedidoAtendido] = useState(() => (pedida ? location.key : null))
  if (pedida && pedidoAtendido !== location.key) {
    setPedidoAtendido(location.key)
    setPrecarga(pedida)
    setNuevaAbierta(true)
  }
  const [detalleRef, mostrarDetalle] = useDetalleEnMobile()
  const idPendientes = useId()
  const idResueltas = useId()

  // Se limpia el state para que recargar la página no vuelva a abrir el alta.
  useEffect(() => {
    if (pedida) navigate(location.pathname, { replace: true, state: null })
  }, [pedida, location.pathname, navigate])

  const cerrarNueva = () => {
    setNuevaAbierta(false)
    setPrecarga(null)
  }

  useEffect(() => {
    if (!assetId) return
    const controller = new AbortController()
    let vivo = true

    fetchRentalRequests(assetId, { userId, signal: controller.signal })
      .then((solicitudes) => {
        if (vivo) setCarga({ estado: 'ok', solicitudes })
      })
      .catch((err) => {
        if (vivo && err.name !== 'AbortError') setCarga({ estado: 'error', solicitudes: [] })
      })

    return () => {
      vivo = false
      controller.abort()
    }
  }, [assetId, userId, intento])

  const reemplazar = (actualizada) => {
    setCarga((prev) => ({
      ...prev,
      solicitudes: prev.solicitudes.map((s) => (s.id === actualizada.id ? actualizada : s)),
    }))
  }

  const seleccionar = (id, nuevoModo = 'ver') => {
    setSeleccion(id)
    setModo(nuevoModo)
    setEnvio({ enviando: false, error: null })
  }

  async function votar(id, borrador) {
    const { error, voto } = validarVoto(borrador)
    if (error) {
      setEnvio({ enviando: false, error })
      return
    }
    setEnvio({ enviando: true, error: null })
    try {
      reemplazar(await voteRentalRequest(id, { userId, ...voto }))
      setModo('ver')
      setEnvio({ enviando: false, error: null })
    } catch (err) {
      setEnvio({ enviando: false, error: err.message })
    }
  }

  async function accionar(id, accion) {
    setEnvio({ enviando: true, error: null })
    try {
      reemplazar(await ACCIONES[accion](id, { userId }))
      setModo('ver')
      setEnvio({ enviando: false, error: null })
    } catch (err) {
      setEnvio({ enviando: false, error: err.message })
    }
  }

  // Errores de red o del server se propagan al modal para mostrarlos ahí.
  async function crear(solicitud) {
    const creada = await createRentalRequest({ assetId, userId, ...solicitud })
    setCarga((prev) => ({ ...prev, solicitudes: [creada, ...prev.solicitudes] }))
    cerrarNueva()
    seleccionar(creada.id)
  }

  const reintentar = () => {
    setCarga({ estado: 'loading', solicitudes: [] })
    setIntento((n) => n + 1)
  }

  if (!assetId) {
    return <p className="panel empty">No encontramos tu sesión. Volvé a entrar.</p>
  }

  if (carga.estado === 'loading') {
    return (
      <p className="panel empty" role="status">
        Cargando solicitudes…
      </p>
    )
  }

  if (carga.estado === 'error') {
    return (
      <div className="panel empty empty--rail" role="alert">
        <p>No se pudieron cargar las solicitudes.</p>
        <p className="hint">Si el backend estuvo inactivo, el primer request puede tardar ~30–50 s.</p>
        <button type="button" className="btn btn--sm" onClick={reintentar}>
          Reintentar
        </button>
      </div>
    )
  }

  const cabecera = (
    <>
      {carga.solicitudes.length > 0 && (
        <p className="hint alq-regla">
          Cada alquiler requiere la aprobación de los {carga.solicitudes[0].coownerCount}{' '}
          copropietarios.
        </p>
      )}
      <NewRentalRequestModal
        abierto={nuevaAbierta}
        inicial={precarga}
        onClose={cerrarNueva}
        onCreate={crear}
      />
    </>
  )

  if (carga.solicitudes.length === 0) {
    return (
      <>
        {cabecera}
        <p className="panel empty">Todavía no hay solicitudes de alquiler para este bien.</p>
      </>
    )
  }

  const { pendientes, resueltas } = agrupar(carga.solicitudes)
  const seleccionada = carga.solicitudes.find((s) => s.id === seleccion) ?? null
  const puedeVotar = Boolean(userId)

  const tarjeta = (s) => (
    <RentalRequestCard
      key={s.id}
      solicitud={s}
      seleccionada={s.id === seleccion}
      puedeVotar={puedeVotar}
      enviando={envio.enviando}
      onSelect={() => {
        seleccionar(s.id)
        mostrarDetalle()
      }}
      onApprove={() => {
        seleccionar(s.id)
        votar(s.id, { value: 'APPROVE' })
      }}
      onOpenReject={() => seleccionar(s.id, 'rechazar')}
      onChangeVote={() => seleccionar(s.id)}
    />
  )

  return (
    <>
      {cabecera}

      <div className="split alq-split">
        <div className="split__main">
          <section aria-labelledby={idPendientes} className="alq-grupo">
            <h2 id={idPendientes} className="sect alq-grupo__t">
              Pendientes de aprobación
            </h2>
            {pendientes.length === 0 ? (
              <p className="empty">No hay solicitudes esperando votación.</p>
            ) : (
              <div className="alq-lista">{pendientes.map(tarjeta)}</div>
            )}
          </section>

          {resueltas.length > 0 && (
            <section aria-labelledby={idResueltas} className="alq-grupo">
              <h2 id={idResueltas} className="sect alq-grupo__t">
                Resueltas
              </h2>
              <div className="alq-lista alq-lista--resueltas">{resueltas.map(tarjeta)}</div>
            </section>
          )}
        </div>

        <RentalRequestDetail
          ref={detalleRef}
          key={seleccion ?? 'ninguna'}
          solicitud={seleccionada}
          modo={modo}
          envio={envio}
          puedeVotar={puedeVotar}
          onApprove={() => votar(seleccion, { value: 'APPROVE' })}
          onOpenReject={() => {
            setModo('rechazar')
            setEnvio({ enviando: false, error: null })
          }}
          onCancelReject={() => {
            setModo('ver')
            setEnvio({ enviando: false, error: null })
          }}
          onSubmitReject={(motivo) => votar(seleccion, { value: 'REJECT', reason: motivo })}
          onChangeVote={() => setModo('cambiar')}
          onOpenAction={(accion) => {
            setModo(accion)
            setEnvio({ enviando: false, error: null })
          }}
          onCancelAction={() => {
            setModo('ver')
            setEnvio({ enviando: false, error: null })
          }}
          onConfirmAction={(accion) => accionar(seleccion, accion)}
        />
      </div>
    </>
  )
}

export default RentalRequests
