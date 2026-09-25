import { useEffect, useId, useState } from 'react'
import NewDecisionModal from '../components/NewDecisionModal'
import { ASSET_ID } from '../lib/currentAsset'
import { USER_ID } from '../lib/currentUser'
import { ESTADOS, FILTROS, filtrar, textoFecha, textoMonto, textoVotos } from '../lib/decisions'
import { createDecision, fetchClosedDecisions, fetchOpenDecisions } from '../services/decision'
import './Decisiones.css'

// Carga una lista de decisiones; recargar() la vuelve a pedir (reintento o alta nueva).
function useDecisiones(fetcher, assetId) {
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
  }, [fetcher, assetId, intento])

  const reintentar = () => {
    setCarga({ estado: 'loading', decisiones: [] })
    setIntento((n) => n + 1)
  }
  // Sin pasar por "Cargando…": la lista actual queda visible hasta que llega la nueva.
  const recargar = () => setIntento((n) => n + 1)

  return { carga, reintentar, recargar }
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

function DecisionAbierta({ decision }) {
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

function EnVotacion({ assetId }) {
  const { carga, reintentar, recargar } = useDecisiones(fetchOpenDecisions, assetId)
  const [modalAbierto, setModalAbierto] = useState(false)
  const idTitulo = useId()

  async function crear(decision) {
    await createDecision({ ...decision, assetId, userId: USER_ID })
    setModalAbierto(false)
    recargar()
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

      {carga.estado === 'ok' && carga.decisiones.length > 0 ? (
        <div className="decisiones-lista">
          {carga.decisiones.map((d) => (
            <DecisionAbierta key={d.id} decision={d} />
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

function Historial({ assetId }) {
  const { carga, reintentar } = useDecisiones(fetchClosedDecisions, assetId)
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
  return (
    <section className="decisiones">
      <h1 className="decisiones-titulo">Decisiones grupales</h1>
      {assetId ? (
        <>
          <EnVotacion assetId={assetId} />
          <Historial assetId={assetId} />
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
