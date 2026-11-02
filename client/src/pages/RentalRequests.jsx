import { useEffect, useId, useState } from 'react'
import { useLocation, useNavigate, useOutletContext } from 'react-router'
import RentalRequestCard from '../components/RentalRequestCard'
import NewRentalRequestModal from '../components/NewRentalRequestModal'
import RentalRequestDetail from '../components/RentalRequestDetail'
import Pagination from '../components/Pagination'
import { Cargando, ErrorCarga, Vacio } from '../components/ui/Estado'
import { assetIdActual } from '../lib/currentAsset'
import { userIdActual } from '../lib/currentUser'
import { agrupar, textoCierre, validarVoto } from '../lib/rentalRequests'
import { useDetalleEnMobile } from '../lib/useDetalleEnMobile'
import { usePaginacion } from '../lib/pagination'
import { fetchSettings } from '../services/settings'
import {
  cancelRental,
  createRentalRequest,
  fetchRentalRequests,
  markRentalPaid,
  voteRentalRequest,
  updateRentalAmount,
} from '../services/rentalRequest'

const ACCIONES = { pagar: markRentalPaid, cancelar: cancelRental }

function RentalRequests({ assetId = assetIdActual(), userId = userIdActual() }) {
  const [carga, setCarga] = useState({ estado: 'loading', solicitudes: [] })
  const [intento, setIntento] = useState(0)
  const [seleccion, setSeleccion] = useState(null)
  const [modo, setModo] = useState('ver')
  const [envio, setEnvio] = useState({ enviando: false, error: null })
  // La que acaba de aprobarse con el voto propio: la tarjeta se ilumina un momento.
  const [aprobada, setAprobada] = useState(null) // { id, texto }
  const location = useLocation()
  const navigate = useNavigate()
  // El alta se abre con este state: lo mandan "Cargar solicitud" de la barra de
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
  const [precioPorDia, setPrecioPorDia] = useState(null)
  // undefined mientras no llega: no se anuncia ni plazo ni "sin plazo".
  const [plazoHoras, setPlazoHoras] = useState(undefined)
  const [detalleRef, mostrarDetalle] = useDetalleEnMobile()
  const idPendientes = useId()
  const idResueltas = useId()

  // Se limpia el state para que recargar la página no vuelva a abrir el alta.
  useEffect(() => {
    if (pedida) navigate(location.pathname, { replace: true, state: null })
  }, [pedida, location.pathname, navigate])

  // Si no se puede traer, el alta sigue andando: el monto se escribe a mano.
  useEffect(() => {
    if (!assetId || !userId) return
    const controller = new AbortController()
    fetchSettings(assetId, userId, { signal: controller.signal })
      .then((settings) => {
        setPrecioPorDia(settings.rentalDailyRate)
        setPlazoHoras(settings.responseHours)
      })
      .catch(() => setPrecioPorDia(null))
    return () => controller.abort()
  }, [assetId, userId])

  const setDetalleAbierto = useOutletContext()?.setDetalleAbierto
  const hayDetalle = carga.solicitudes.some((s) => s.id === seleccion)
  useEffect(() => {
    setDetalleAbierto?.(hayDetalle)
    return () => setDetalleAbierto?.(false)
  }, [hayDetalle, setDetalleAbierto])

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
      const actualizada = await voteRentalRequest(id, { userId, ...voto })
      const antes = carga.solicitudes.find((s) => s.id === id)
      reemplazar(actualizada)
      if (antes?.status === 'PENDING' && actualizada.status === 'APPROVED') {
        setAprobada({ id, texto: `${textoCierre(actualizada)} Ya quedó reservada en el calendario.` })
      }
      setModo('ver')
      setEnvio({ enviando: false, error: null })
    } catch (err) {
      setEnvio({ enviando: false, error: err.message })
    }
  }

  async function accionar(id, accion, extra = {}) {
    setEnvio({ enviando: true, error: null })
    try {
      reemplazar(await ACCIONES[accion](id, { userId, ...extra }))
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

  const { pendientes, resueltas } = agrupar(carga.solicitudes)
  const pendientesOrdenadas = [...pendientes].sort((a, b) => a.startDate.localeCompare(b.startDate))
  const resueltasOrdenadas = [...resueltas].sort((a, b) => b.startDate.localeCompare(a.startDate))
  const paginaPendientes = usePaginacion(pendientesOrdenadas, 'pendientes')
  const paginaResueltas = usePaginacion(resueltasOrdenadas, 'resueltas')

  if (!assetId) {
    return <Vacio panel titulo="La sesión no está activa.">Ingresar de nuevo para continuar.</Vacio>
  }

  if (carga.estado === 'loading') {
    return (
      <Cargando filas={4}>Cargando solicitudes…</Cargando>
    )
  }

  if (carga.estado === 'error') {
    return (
      <ErrorCarga titulo="No se pudieron cargar las solicitudes." onReintentar={reintentar} />
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
        precioPorDia={precioPorDia}
        onClose={cerrarNueva}
        onCreate={crear}
      />
    </>
  )

  if (carga.solicitudes.length === 0) {
    return (
      <>
        {cabecera}
        <Vacio panel titulo="Todavía no hay solicitudes de alquiler para este bien.">
          Llegan solas desde la ficha pública, o se cargan a mano con «Cargar solicitud».
        </Vacio>
      </>
    )
  }

  const seleccionada = carga.solicitudes.find((s) => s.id === seleccion) ?? null
  const puedeVotar = Boolean(userId)

  const tarjeta = (s) => (
    <RentalRequestCard
      key={s.id}
      solicitud={s}
      seleccionada={s.id === seleccion}
      recienAprobada={s.id === aprobada?.id}
      puedeVotar={puedeVotar}
      plazoHoras={plazoHoras}
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
      <p className="solo-lector" aria-live="polite">
        {aprobada?.texto}
      </p>

      <div className="split alq-split">
        <div className="split__main">
          <section aria-labelledby={idPendientes} className="alq-grupo">
            <h2 id={idPendientes} className="sect alq-grupo__t">
              Pendientes de aprobación
            </h2>
            {pendientes.length === 0 ? (
              <p className="empty">No hay solicitudes esperando votación.</p>
            ) : (
              <div className="alq-lista">{paginaPendientes.elementos.map(tarjeta)}</div>
            )}
            <Pagination {...paginaPendientes} />
          </section>

          {resueltas.length > 0 && (
            <section aria-labelledby={idResueltas} className="alq-grupo">
              <h2 id={idResueltas} className="sect alq-grupo__t">
                Resueltas
              </h2>
              <div className="alq-lista alq-lista--resueltas">{paginaResueltas.elementos.map(tarjeta)}</div>
              <Pagination {...paginaResueltas} />
            </section>
          )}
        </div>

        <RentalRequestDetail
          ref={detalleRef}
          key={seleccion ?? 'ninguna'}
          solicitud={seleccionada}
          plazoHoras={plazoHoras}
          userId={userId}
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
          onConfirmAction={(accion, extra) => accionar(seleccion, accion, extra)}
          onUpdateAmount={async (amount) => reemplazar(await updateRentalAmount(seleccion, { userId, amount }))}
        />
      </div>
    </>
  )
}

export default RentalRequests
