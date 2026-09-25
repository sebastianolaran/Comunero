import { useEffect, useId, useState } from 'react'
import NewDecisionModal from '../components/NewDecisionModal'
import { ASSET_ID } from '../lib/currentAsset'
import { USER_ID } from '../lib/currentUser'
import {
  ESTADOS,
  FILTROS,
  OPCIONES_VOTO,
  filtrar,
  mostrarBotones,
  textoFecha,
  textoMonto,
  textoTuVoto,
  textoVotos,
} from '../lib/decisions'
import { createDecision, fetchClosedDecisions, fetchOpenDecisions, voteDecision } from '../services/decision'
import './Decisiones.css'

// Referencia estable: useDecisiones la usa como dependencia del efecto.
const fetchAbiertas = (assetId, opciones) => fetchOpenDecisions(assetId, { ...opciones, userId: USER_ID })

// Carga una lista de decisiones. `version` fuerza una recarga desde afuera.
function useDecisiones(fetcher, assetId, version = 0) {
  const [carga, setCarga] = useState({ estado: 'loading', decisiones: [] })
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let vivo = true

    fetcher(assetId, { signal: controller.signal })
      .then((decisiones) => {
        if (vivo) setCarga({ estado: 'ok', decisiones })
      })
      .catch((err) => {
        if (vivo && err.name !== 'AbortError') setCarga({ estado: 'error', decisiones: [] })
      })

    return () => {
      vivo = false
      controller.abort()
    }
  }, [fetcher, assetId, intento, version])

  const reintentar = () => {
    setCarga({ estado: 'loading', decisiones: [] })
    setIntento((n) => n + 1)
  }
  // Sin pasar por "Cargando…": la lista actual queda visible hasta que llega la nueva.
  const recargar = () => setIntento((n) => n + 1)
  const actualizar = (cambio) => setCarga((prev) => ({ ...prev, decisiones: cambio(prev.decisiones) }))

  return { carga, reintentar, recargar, actualizar }
}

function Aviso({ carga, reintentar, texto, vacio }) {
  if (carga.estado === 'loading') {
    return (
      <p className="decisiones-aviso" role="status">
        Cargando decisiones…
      </p>
    )
  }
  if (carga.estado === 'error') {
    return (
      <div className="decisiones-aviso" role="alert">
        <p>{texto}</p>
        <p className="decisiones-aviso-hint">
          Si el backend estuvo inactivo, el primer request puede tardar ~30–50 s.
        </p>
        <button type="button" className="decisiones-reintentar" onClick={reintentar}>
          Reintentar
        </button>
      </div>
    )
  }
  return <p className="decisiones-aviso">{vacio}</p>
}

function Votacion({ decision, onVotar }) {
  const [editando, setEditando] = useState(false)
  const [envio, setEnvio] = useState({ enviando: false, error: null })

  async function votar(value) {
    setEnvio({ enviando: true, error: null })
    try {
      await onVotar(decision, value)
      setEditando(false)
      setEnvio({ enviando: false, error: null })
    } catch (err) {
      setEnvio({ enviando: false, error: err.message })
    }
  }

  if (!mostrarBotones(decision, editando)) {
    return (
      <div className="decision-tu-voto">
        {textoTuVoto(decision.myVote)}
        <button
          type="button"
          className="decision-editar"
          aria-label="Cambiar voto"
          title="Cambiar voto"
          onClick={() => setEditando(true)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
          </svg>
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="decision-botones" role="group" aria-label={`Votar "${decision.title}"`}>
        {OPCIONES_VOTO.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className="decision-voto"
            aria-pressed={decision.myVote === value}
            disabled={envio.enviando}
            onClick={() => votar(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {envio.error && (
        <p className="decision-error" role="alert">
          {envio.error}
        </p>
      )}
    </>
  )
}

function DecisionAbierta({ decision, onVotar }) {
  const monto = textoMonto(decision.estimated)
  return (
    <article className="decision">
      <div className="decision-cabecera">
        <h3 className="decision-titulo">{decision.title}</h3>
        <span className="decision-estado">{ESTADOS[decision.status] ?? decision.status}</span>
      </div>
      <p className="decision-fecha">{textoFecha(decision.createdAt)}</p>
      {monto && <p className="decision-monto">{monto}</p>}
      <p className="decision-votos">{textoVotos(decision)}</p>
      <Votacion decision={decision} onVotar={onVotar} />
    </article>
  )
}

function DecisionCerrada({ decision }) {
  const monto = textoMonto(decision.estimated)
  return (
    <article className="decision">
      <div className="decision-cabecera">
        <h3 className="decision-titulo">{decision.title}</h3>
        <span className="decision-estado">{ESTADOS[decision.status] ?? decision.status}</span>
      </div>
      {monto && <p className="decision-monto">{monto}</p>}
      <p className="decision-votos">{textoVotos(decision)}</p>
    </article>
  )
}

const CONFLICTO = 409

function EnVotacion({ assetId, onCerrada }) {
  const { carga, reintentar, recargar, actualizar } = useDecisiones(fetchAbiertas, assetId)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [aviso, setAviso] = useState(null)
  const idTitulo = useId()

  async function crear(decision) {
    await createDecision({ ...decision, assetId, userId: USER_ID })
    setModalAbierto(false)
    setAviso(null)
    recargar()
  }

  async function votar(decision, value) {
    setAviso(null)
    try {
      const actualizada = await voteDecision(decision.id, { userId: USER_ID, value })
      if (actualizada.status === 'OPEN') {
        actualizar((ds) => ds.map((d) => (d.id === actualizada.id ? actualizada : d)))
        return
      }
      actualizar((ds) => ds.filter((d) => d.id !== actualizada.id))
      onCerrada()
    } catch (err) {
      if (err.status !== CONFLICTO) throw err
      // La cerró otro mientras esta pantalla la seguía mostrando abierta.
      setAviso(err.message)
      recargar()
      onCerrada()
    }
  }

  return (
    <section className="decisiones-seccion" aria-labelledby={idTitulo}>
      <div className="decisiones-seccion-cabecera">
        <h2 id={idTitulo} className="decisiones-grupo">
          En votación
        </h2>
        <button type="button" className="decisiones-nueva" onClick={() => setModalAbierto(true)}>
          + Nueva decisión
        </button>
      </div>

      {aviso && (
        <p className="decisiones-cerrada" role="alert">
          {aviso}
        </p>
      )}

      {carga.estado === 'ok' && carga.decisiones.length > 0 ? (
        <div className="decisiones-lista">
          {carga.decisiones.map((d) => (
            <DecisionAbierta key={d.id} decision={d} onVotar={votar} />
          ))}
        </div>
      ) : (
        <Aviso
          carga={carga}
          reintentar={reintentar}
          texto="No se pudieron cargar las decisiones en votación."
          vacio="No hay decisiones en votación."
        />
      )}

      <NewDecisionModal abierto={modalAbierto} onClose={() => setModalAbierto(false)} onCreate={crear} />
    </section>
  )
}

function Historial({ assetId, version }) {
  const { carga, reintentar } = useDecisiones(fetchClosedDecisions, assetId, version)
  // Estado local: al volver a entrar a Decisiones siempre arranca en Todas.
  const [filtro, setFiltro] = useState('todas')
  const idTitulo = useId()

  const visibles = filtrar(carga.decisiones, filtro)

  return (
    <section className="decisiones-seccion" aria-labelledby={idTitulo}>
      <div className="decisiones-seccion-cabecera">
        <h2 id={idTitulo} className="decisiones-grupo">
          Historial de decisiones
        </h2>
        <div className="decisiones-filtro" role="group" aria-label="Filtrar historial">
          {FILTROS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className="decisiones-filtro-opcion"
              aria-pressed={filtro === id}
              onClick={() => setFiltro(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {carga.estado === 'ok' && visibles.length > 0 ? (
        <div className="decisiones-lista">
          {visibles.map((d) => (
            <DecisionCerrada key={d.id} decision={d} />
          ))}
        </div>
      ) : (
        <Aviso
          carga={carga}
          reintentar={reintentar}
          texto="No se pudo cargar el historial de decisiones."
          vacio="No hay decisiones en esta categoría."
        />
      )}
    </section>
  )
}

function Decisiones({ assetId = ASSET_ID }) {
  // Sube cuando una propuesta se cierra, para que el historial la traiga.
  const [versionHistorial, setVersionHistorial] = useState(0)

  return (
    <section className="decisiones">
      <h1 className="decisiones-titulo">Decisiones grupales</h1>
      {assetId ? (
        <>
          <EnVotacion assetId={assetId} onCerrada={() => setVersionHistorial((n) => n + 1)} />
          <Historial assetId={assetId} version={versionHistorial} />
        </>
      ) : (
        <p className="decisiones-aviso">
          Falta configurar <code>VITE_DEMO_ASSET_ID</code> en <code>client/.env</code>.
        </p>
      )}
    </section>
  )
}

export default Decisiones
