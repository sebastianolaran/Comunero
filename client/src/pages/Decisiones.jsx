import { useEffect, useId, useState } from 'react'
import { ASSET_ID } from '../lib/currentAsset'
import { ESTADOS, FILTROS, filtrar, textoMonto, textoVotos } from '../lib/decisions'
import { fetchClosedDecisions } from '../services/decision'
import './Decisiones.css'

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

function Historial({ assetId }) {
  const [carga, setCarga] = useState({ estado: 'loading', decisiones: [] })
  const [intento, setIntento] = useState(0)
  // Estado local: al volver a entrar a Decisiones siempre arranca en Todas.
  const [filtro, setFiltro] = useState('todas')
  const idTitulo = useId()

  useEffect(() => {
    const controller = new AbortController()
    let vivo = true

    fetchClosedDecisions(assetId, { signal: controller.signal })
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
  }, [assetId, intento])

  const reintentar = () => {
    setCarga({ estado: 'loading', decisiones: [] })
    setIntento((n) => n + 1)
  }

  const visibles = filtrar(carga.decisiones, filtro)

  return (
    <section className="decisiones-historial" aria-labelledby={idTitulo}>
      <div className="decisiones-historial-cabecera">
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

      {carga.estado === 'loading' && (
        <p className="decisiones-aviso" role="status">
          Cargando decisiones…
        </p>
      )}

      {carga.estado === 'error' && (
        <div className="decisiones-aviso" role="alert">
          <p>No se pudo cargar el historial de decisiones.</p>
          <p className="decisiones-aviso-hint">
            Si el backend estuvo inactivo, el primer request puede tardar ~30–50 s.
          </p>
          <button type="button" className="decisiones-reintentar" onClick={reintentar}>
            Reintentar
          </button>
        </div>
      )}

      {carga.estado === 'ok' &&
        (visibles.length === 0 ? (
          <p className="decisiones-aviso">No hay decisiones en esta categoría.</p>
        ) : (
          <div className="decisiones-lista">
            {visibles.map((d) => (
              <DecisionCerrada key={d.id} decision={d} />
            ))}
          </div>
        ))}
    </section>
  )
}

function Decisiones({ assetId = ASSET_ID }) {
  return (
    <section className="decisiones">
      <h1 className="decisiones-titulo">Decisiones grupales</h1>
      {assetId ? (
        <Historial assetId={assetId} />
      ) : (
        <p className="decisiones-aviso">
          Falta configurar <code>VITE_DEMO_ASSET_ID</code> en <code>client/.env</code>.
        </p>
      )}
    </section>
  )
}

export default Decisiones
