import { useEffect, useMemo, useState } from 'react'
import { ASSET_ID } from '../lib/currentAsset'
import { USER_ID } from '../lib/currentUser'
import { balanceStatus, entryWho, netSummary, sinceLabel } from '../lib/balance'
import { dayLabel, fmtMoney, fmtSigned } from '../lib/movements'
import * as balanceService from '../services/balance'
import './Balance.css'

// Detalle de lo que compone el balance con una persona: movimientos y pagos
// parciales del período vigente, en orden de fecha.
function BalanceDetail({ coowner, id }) {
  return (
    <div className="bal-detail" id={id}>
      <p className="bal-since">{sinceLabel(coowner.since)}</p>
      {coowner.entries.length === 0 ? (
        <p className="bal-empty">Sin movimientos compartidos en este período.</p>
      ) : (
        <ul className="bal-entries">
          {coowner.entries.map((entry) => (
            <li key={`${entry.kind}-${entry.id}`} className="bal-entry">
              <span className="bal-entry-date">{dayLabel(entry.date)}</span>
              <span className="bal-entry-desc">
                <span className="bal-entry-title">
                  {entry.description}
                  {entry.isRental && <span className="bal-tag bal-tag-rental">ALQUILER</span>}
                </span>
                <span className="bal-entry-who">
                  {entryWho(entry, USER_ID)} · total {fmtMoney(entry.total)}
                </span>
              </span>
              <span className={`bal-entry-amount bal-tone-${balanceStatus(entry.amount).tone}`}>
                {fmtSigned(entry.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function BalanceItem({ coowner }) {
  const [open, setOpen] = useState(false)
  const status = balanceStatus(coowner.balance)
  const detailId = `bal-detail-${coowner.user.id}`

  return (
    <li className="bal-item">
      <div className="bal-row">
        <button
          type="button"
          className="bal-toggle"
          aria-expanded={open}
          aria-controls={detailId}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="bal-caret" aria-hidden="true">{open ? '▾' : '▸'}</span>
          <span className="bal-name">{coowner.user.name}</span>
          {coowner.upToDate && <span className="bal-tag">Al día</span>}
          {coowner.hasPartialPayments && <span className="bal-tag">Con pagos parciales</span>}
        </button>
        <div className="bal-right">
          <span className="bal-amount-wrap">
            <span className={`bal-amount bal-tone-${status.tone}`}>{fmtSigned(coowner.balance)}</span>
            {!coowner.upToDate && <span className="bal-status">{status.text}</span>}
          </span>
          {coowner.canSettle && (
            // Saldar la deuda es otra historia: por ahora el botón solo se muestra.
            <button type="button" className="bal-btn bal-btn-primary" disabled title="Próximamente">
              Saldar
            </button>
          )}
        </div>
      </div>
      {open && <BalanceDetail coowner={coowner} id={detailId} />}
    </li>
  )
}

function Balance() {
  const quien = useMemo(() => ({ assetId: ASSET_ID, userId: USER_ID }), [])
  const [data, setData] = useState(null) // { net, coowners }
  const [error, setError] = useState(null)
  const configurado = Boolean(ASSET_ID && USER_ID)

  useEffect(() => {
    if (!configurado) return undefined
    const controlador = new AbortController()
    balanceService
      .fetchBalances(quien, { signal: controlador.signal })
      .then((result) => {
        setData(result)
        setError(null)
      })
      .catch((err) => !controlador.signal.aborted && setError(err.message))
    return () => controlador.abort()
  }, [quien, configurado])

  if (!configurado) {
    return (
      <p className="aviso">
        Falta configurar <code>VITE_DEMO_ASSET_ID</code> y <code>VITE_DEMO_USER_ID</code> en{' '}
        <code>client/.env</code>.
      </p>
    )
  }

  return (
    <section className="bal">
      <h1 className="bal-title">Balance</h1>

      {error && (
        <p className="bal-alert" role="alert">
          No se pudo cargar el balance: {error}
        </p>
      )}

      {!data && !error && <p className="bal-loading">Cargando balance…</p>}

      {data && (
        <>
          <div className="bal-summary">
            <p className="bal-summary-label">Balance neto</p>
            <p className={`bal-net bal-tone-${balanceStatus(data.net).tone}`}>{fmtSigned(data.net)}</p>
            <p className="bal-sub">{netSummary(data.net)}</p>
          </div>

          {data.coowners.length === 0 ? (
            <p className="bal-empty">No hay otros copropietarios en este bien.</p>
          ) : (
            <ul className="bal-list">
              {data.coowners.map((coowner) => (
                <BalanceItem key={coowner.user.id} coowner={coowner} />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

export default Balance
