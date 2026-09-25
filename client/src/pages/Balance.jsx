import { useEffect, useId, useMemo, useRef, useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
import { assetIdActual } from '../lib/currentAsset'
import { userIdActual } from '../lib/currentUser'
import { balanceStatus, closedWho, entryWho, netSummary, partialAmountError, sinceLabel } from '../lib/balance'
import { dayLabel, fmtMoney, fmtSigned } from '../lib/movements'
import * as balanceService from '../services/balance'
// Los modales usan los estilos de los de Movimientos (mov-modal, mov-btn).
import './Movimientos.css'
import './Balance.css'

// Líneas de un detalle (abierto o de un saldo cerrado), en orden de fecha.
function EntryList({ entries }) {
  return (
    <ul className="bal-entries">
      {entries.map((entry) => (
        <li key={`${entry.kind}-${entry.id}`} className="bal-entry">
          <span className="bal-entry-date">{dayLabel(entry.date)}</span>
          <span className="bal-entry-desc">
            <span className="bal-entry-title">
              {entry.description}
              {entry.isRental && <span className="bal-tag bal-tag-rental">ALQUILER</span>}
            </span>
            <span className="bal-entry-who">
              {entryWho(entry, userIdActual())} · total {fmtMoney(entry.total)}
            </span>
          </span>
          <span className={`bal-entry-amount bal-tone-${balanceStatus(entry.amount).tone}`}>
            {fmtSigned(entry.amount)}
          </span>
        </li>
      ))}
    </ul>
  )
}

// Detalle de lo que compone el balance con una persona: movimientos y pagos
// parciales del período vigente, en orden de fecha.
function BalanceDetail({ coowner, id }) {
  return (
    <div className="bal-detail" id={id}>
      <p className="bal-since">{sinceLabel(coowner.since)}</p>
      {coowner.entries.length === 0 ? (
        <p className="bal-empty">Sin movimientos compartidos en este período.</p>
      ) : (
        <EntryList entries={coowner.entries} />
      )}
    </div>
  )
}

function BalanceItem({ coowner, onSettle }) {
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
            <button type="button" className="bal-btn bal-btn-primary" onClick={() => onSettle(coowner)}>
              Saldar
            </button>
          )}
        </div>
      </div>
      {open && <BalanceDetail coowner={coowner} id={detailId} />}
    </li>
  )
}

// Primer paso de "Saldar": pago total o parcial.
function SettleChoice({ name, onTotal, onPartial, onCancel }) {
  const dialogo = useRef(null)
  const total = useRef(null)
  const id = useId()

  useEffect(() => {
    dialogo.current.showModal()
    total.current.focus()
  }, [])

  return (
    <dialog
      ref={dialogo}
      className="mov-modal mov-modal-sm"
      aria-labelledby={`${id}-titulo`}
      onClose={onCancel}
      onClick={(e) => {
        if (e.target === dialogo.current) onCancel()
      }}
    >
      <h2 id={`${id}-titulo`} className="mov-modal-title">
        Saldar deuda con {name}
      </h2>
      <div className="bal-choice">
        <button ref={total} type="button" className="mov-btn mov-btn-primary" onClick={onTotal}>
          Pago total
        </button>
        <button type="button" className="mov-btn" onClick={onPartial}>
          Pago parcial
        </button>
      </div>
      <button type="button" className="mov-btn" onClick={onCancel}>
        Cancelar
      </button>
    </dialog>
  )
}

// Segundo paso del pago parcial: cuánto le pagaste. Solo pasa a confirmar si
// el monto es mayor a $0 y menor que la deuda vigente (owed).
function PartialAmountForm({ name, owed, initialValue, serverError, onSubmit, onCancel }) {
  const dialogo = useRef(null)
  const campo = useRef(null)
  const id = useId()
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState(serverError)

  useEffect(() => {
    dialogo.current.showModal()
    campo.current.focus()
  }, [])

  function handleSubmit(event) {
    event.preventDefault()
    const problema = partialAmountError(value, owed, name)
    if (problema) {
      setError(problema)
      return
    }
    onSubmit(Number(value))
  }

  return (
    <dialog
      ref={dialogo}
      className="mov-modal mov-modal-sm"
      aria-labelledby={`${id}-titulo`}
      onClose={onCancel}
      onClick={(e) => {
        if (e.target === dialogo.current) onCancel()
      }}
    >
      <h2 id={`${id}-titulo`} className="mov-modal-title">
        Pago parcial a {name}
      </h2>
      <form className="mov-modal-form" onSubmit={handleSubmit} noValidate>
        <div className={`mov-field${error ? ' is-error' : ''}`}>
          <label className="mov-field-label" htmlFor={`${id}-monto`}>
            ¿Cuánto le pagaste?
          </label>
          <div className="mov-money-input">
            <span aria-hidden="true">$</span>
            <input
              ref={campo}
              id={`${id}-monto`}
              className="mov-input"
              type="number"
              inputMode="numeric"
              step="1"
              placeholder="0"
              value={value}
              aria-invalid={Boolean(error)}
              aria-describedby={`${id}-ayuda`}
              onChange={(event) => {
                setValue(event.target.value)
                setError(null)
              }}
            />
          </div>
          {error ? (
            <p id={`${id}-ayuda`} className="mov-field-error" role="alert">
              {error}
            </p>
          ) : (
            <p id={`${id}-ayuda`} className="mov-field-hint">
              Le debés {fmtMoney(owed)}. Tiene que ser menos: para saldar todo usá el pago total.
            </p>
          )}
        </div>
        <div className="mov-modal-actions">
          <button type="button" className="mov-btn" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" className="mov-btn mov-btn-primary">
            Continuar
          </button>
        </div>
      </form>
    </dialog>
  )
}

function ClosedSettlement({ settlement }) {
  const [open, setOpen] = useState(false)
  const detailId = `bal-closed-${settlement.id}`

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
          <span className="bal-name">Saldo cerrado con {settlement.other.name}</span>
          <span className="bal-closed-date">{dayLabel(settlement.date)}</span>
        </button>
        <span className="bal-amount-wrap">
          <span className="bal-amount">{fmtMoney(settlement.amount)}</span>
          <span className="bal-status">{closedWho(settlement, settlement.other.name)}</span>
        </span>
      </div>
      {open && (
        <div className="bal-detail" id={detailId}>
          {settlement.entries.length === 0 ? (
            <p className="bal-empty">Sin detalle guardado.</p>
          ) : (
            <EntryList entries={settlement.entries} />
          )}
        </div>
      )}
    </li>
  )
}

function Balance() {
  const quien = useMemo(() => ({ assetId: assetIdActual(), userId: userIdActual() }), [])
  const [data, setData] = useState(null) // { net, coowners }
  const [error, setError] = useState(null)
  const [recarga, setRecarga] = useState(0)
  // Saldar en curso: { user, amount, step, busy, error, partial }. amount es la
  // deuda vigente; partial, el monto del pago parcial. step: 'choice' (total
  // o parcial), 'confirm' (pago total), 'partial' (cargar el monto) o
  // 'confirmPartial'.
  const [settling, setSettling] = useState(null)
  const configurado = Boolean(quien.assetId && quien.userId)

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
  }, [quien, configurado, recarga])

  // Todos los saldos cerrados, con quién, del más nuevo al más viejo.
  const cerrados = useMemo(() => {
    if (!data) return []
    return data.coowners
      .flatMap((coowner) => coowner.closedSettlements.map((s) => ({ ...s, other: coowner.user })))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  }, [data])

  function empezarASaldar(coowner) {
    setSettling({
      user: coowner.user,
      amount: -coowner.balance,
      step: 'choice',
      busy: false,
      error: null,
      partial: null,
    })
  }

  // Cerrar un diálogo al pasar al paso siguiente también dispara su onClose:
  // solo cancela si seguimos en ese paso.
  function cancelarPaso(step) {
    setSettling((actual) => (actual?.step === step ? null : actual))
  }

  const irA = (step, cambios = {}) => setSettling((actual) => ({ ...actual, step, ...cambios }))

  async function confirmarPagoParcial() {
    const { user, partial } = settling
    setSettling((actual) => ({ ...actual, busy: true, error: null }))
    try {
      await balanceService.payPartial({ assetId: quien.assetId, fromUserId: quien.userId, toUserId: user.id, amount: partial })
      setSettling(null)
    } catch (err) {
      // Si la deuda cambió y el monto ya no entra, vuelve a cargar el monto
      // con la deuda actual; si no, el error queda en el modal.
      setSettling((actual) => {
        if (!actual) return actual
        if (err.currentAmount) {
          return { ...actual, busy: false, step: 'partial', error: err.message, amount: err.currentAmount }
        }
        return { ...actual, busy: false, error: err.message }
      })
    }
    setRecarga((n) => n + 1)
  }

  async function confirmarPagoTotal() {
    const { user, amount } = settling
    setSettling((actual) => ({ ...actual, busy: true, error: null }))
    try {
      await balanceService.closeBalance({ assetId: quien.assetId, fromUserId: quien.userId, toUserId: user.id, amount })
      setSettling(null)
    } catch (err) {
      // Si el balance cambió, el modal pasa a mostrar el monto actual.
      const error = err.currentAmount
        ? `El balance cambió mientras confirmabas: ahora le debés ${fmtMoney(err.currentAmount)}.`
        : err.message
      setSettling((actual) =>
        actual && { ...actual, busy: false, error, amount: err.currentAmount ?? actual.amount },
      )
    }
    setRecarga((n) => n + 1)
  }

  if (!configurado) {
    return (
      <p className="aviso">No encontramos tu sesión. Volvé a entrar.</p>
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
                <BalanceItem key={coowner.user.id} coowner={coowner} onSettle={empezarASaldar} />
              ))}
            </ul>
          )}

          <h2 className="bal-section-title">Saldos cerrados</h2>
          {cerrados.length === 0 ? (
            <p className="bal-empty">Todavía no hay saldos cerrados.</p>
          ) : (
            <ul className="bal-list">
              {cerrados.map((settlement) => (
                <ClosedSettlement key={settlement.id} settlement={settlement} />
              ))}
            </ul>
          )}
        </>
      )}

      {/* Los modales toman las variables de color de .mov */}
      {settling && (
        <div className="mov">
          {settling.step === 'choice' && (
            <SettleChoice
              name={settling.user.name}
              onTotal={() => irA('confirm')}
              onPartial={() => irA('partial')}
              onCancel={() => cancelarPaso('choice')}
            />
          )}
          {settling.step === 'partial' && (
            <PartialAmountForm
              name={settling.user.name}
              owed={settling.amount}
              initialValue={settling.partial === null ? '' : String(settling.partial)}
              serverError={settling.error}
              onSubmit={(partial) => irA('confirmPartial', { partial, error: null })}
              onCancel={() => cancelarPaso('partial')}
            />
          )}
          {settling.step === 'confirmPartial' && (
            <ConfirmDialog
              title={`Pago parcial a ${settling.user.name}`}
              lines={[
                `¿Confirmás que le pagaste ${fmtMoney(settling.partial)} a ${settling.user.name}?`,
                `Le vas a seguir debiendo ${fmtMoney(settling.amount - settling.partial)}.`,
              ]}
              confirmLabel="Confirmar pago"
              busyLabel="Guardando…"
              busy={settling.busy}
              error={settling.error}
              onConfirm={confirmarPagoParcial}
              onCancel={() => cancelarPaso('confirmPartial')}
            />
          )}
          {settling.step === 'confirm' && (
            <ConfirmDialog
              title={`Saldar deuda con ${settling.user.name}`}
              lines={[
                `¿Confirmás que le pagaste ${fmtMoney(settling.amount)} a ${settling.user.name}?`,
                'El balance entre ustedes pasa a $0 y el detalle queda guardado en Saldos cerrados.',
              ]}
              confirmLabel="Confirmar pago"
              busyLabel="Guardando…"
              busy={settling.busy}
              error={settling.error}
              onConfirm={confirmarPagoTotal}
              onCancel={() => setSettling(null)}
            />
          )}
        </div>
      )}
    </section>
  )
}

export default Balance
