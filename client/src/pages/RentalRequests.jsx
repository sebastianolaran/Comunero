import { useEffect, useId, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import RentalRequestCard from '../components/RentalRequestCard'
import NewRentalRequestModal from '../components/NewRentalRequestModal'
import RentalRequestDetail from '../components/RentalRequestDetail'
import { agrupar, validarVoto } from '../lib/rentalRequests'
import {
  cancelRental,
  createRentalRequest,
  fetchRentalRequests,
  markRentalPaid,
  voteRentalRequest,
} from '../services/rentalRequest'

const ACCIONES = { pagar: markRentalPaid, cancelar: cancelRental }

// TODO: usar el bien del usuario logueado cuando exista el login.
const ASSET_ID = import.meta.env.VITE_DEMO_ASSET_ID
const USER_ID = import.meta.env.VITE_DEMO_USER_ID

function RentalRequests({ assetId = ASSET_ID, userId = USER_ID }) {
  const [carga, setCarga] = useState({ estado: 'loading', solicitudes: [] })
  const [intento, setIntento] = useState(0)
  const [seleccion, setSeleccion] = useState(null)
  const [modo, setModo] = useState('ver')
  const [envio, setEnvio] = useState({ enviando: false, error: null })
  const location = useLocation()
  const navigate = useNavigate()
  // Viene del historial de inquilinos con el nombre y el teléfono para precargar el alta.
  const [precarga, setPrecarga] = useState(() => location.state?.nuevaSolicitud ?? null)
  const [nuevaAbierta, setNuevaAbierta] = useState(() => Boolean(location.state?.nuevaSolicitud))
  const idPendientes = useId()
  const idResueltas = useId()

  // Se limpia el state del historial para que recargar la página no vuelva a abrir el alta.
  useEffect(() => {
    if (location.state?.nuevaSolicitud) navigate(location.pathname, { replace: true, state: null })
  }, [location, navigate])

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
    return (
      <p className="aviso">
        Falta configurar <code>VITE_DEMO_ASSET_ID</code> en <code>client/.env</code>.
      </p>
    )
  }

  if (carga.estado === 'loading') {
    return (
      <p className="aviso" role="status">
        Cargando solicitudes…
      </p>
    )
  }

  if (carga.estado === 'error') {
    return (
      <div className="aviso" role="alert">
        <p>No se pudieron cargar las solicitudes.</p>
        <p className="aviso-hint">
          Si el backend estuvo inactivo, el primer request puede tardar ~30–50 s.
        </p>
        <button type="button" className="aviso-reintentar" onClick={reintentar}>
          Reintentar
        </button>
      </div>
    )
  }

  const cabecera = (
    <div className="solicitudes-cabecera">
      {carga.solicitudes.length > 0 && (
        <p className="solicitudes-regla">
          Cada alquiler requiere la aprobación de los {carga.solicitudes[0].coownerCount}{' '}
          copropietarios
        </p>
      )}
      {userId && (
        <button type="button" className="nueva-abrir" onClick={() => setNuevaAbierta(true)}>
          + Nueva solicitud
        </button>
      )}
      <NewRentalRequestModal
        abierto={nuevaAbierta}
        inicial={precarga}
        onClose={cerrarNueva}
        onCreate={crear}
      />
    </div>
  )

  if (carga.solicitudes.length === 0) {
    return (
      <div className="solicitudes">
        {cabecera}
        <p className="aviso">Todavía no hay solicitudes de alquiler para este bien.</p>
      </div>
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
      onSelect={() => seleccionar(s.id)}
      onApprove={() => {
        seleccionar(s.id)
        votar(s.id, { value: 'APPROVE' })
      }}
      onOpenReject={() => seleccionar(s.id, 'rechazar')}
      onChangeVote={() => seleccionar(s.id)}
    />
  )

  return (
    <div className="solicitudes">
      {cabecera}

      <div className="solicitudes-layout">
        <div className="solicitudes-lista">
          <section aria-labelledby={idPendientes}>
            <h2 id={idPendientes} className="solicitudes-grupo">
              Pendientes de aprobación
            </h2>
            {pendientes.length === 0 ? (
              <p className="solicitudes-vacio">No hay solicitudes esperando votación.</p>
            ) : (
              pendientes.map(tarjeta)
            )}
          </section>

          {resueltas.length > 0 && (
            <section aria-labelledby={idResueltas} className="solicitudes-resueltas">
              <h2 id={idResueltas} className="solicitudes-grupo">
                Resueltas
              </h2>
              {resueltas.map(tarjeta)}
            </section>
          )}
        </div>

        <RentalRequestDetail
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
    </div>
  )
}

export default RentalRequests
