import { useEffect, useId, useMemo, useRef, useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
import { Cargando, ErrorCarga, Vacio } from '../components/ui/Estado'
import FieldError from '../components/ui/FieldError'
import MemberName from '../components/ui/MemberName'
import Modal, { ModalAcciones } from '../components/ui/Modal'
import { assetIdActual } from '../lib/currentAsset'
import { userIdActual } from '../lib/currentUser'
import { balanceStatus, textoSaldoCon, closedWho, entryWho, netSummary, partialAmountError, sinceLabel } from '../lib/balance'
import { descripcionLegible } from '../lib/format'
import { useTonos } from '../lib/useTonos'
import { dayLabel, fmtMoney, fmtSigned } from '../lib/movements'
import * as balanceService from '../services/balance'
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
              {descripcionLegible(entry.description)}
              {entry.isRental && <span className="tag bal-tag-rental">Alquiler</span>}
            </span>
            <span className="bal-entry-who">
              {entryWho(entry)} · total {fmtMoney(entry.total)}
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
  const tonos = useTonos()
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
          <svg className={open ? 'chev bal-caret is-open' : 'chev bal-caret'} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
          <span className="bal-name">
            <MemberName id={coowner.user.id} name={coowner.user.name} tonos={tonos} />
          </span>
          {coowner.upToDate && <span className="badge">Al día</span>}
          {coowner.hasPartialPayments && <span className="badge badge--line">Con pagos parciales</span>}
        </button>
        <div className="bal-right">
          <span className="bal-amount-wrap">
            <span className={`bal-amount bal-tone-${status.tone}`}>{fmtSigned(coowner.balance)}</span>
            {!coowner.upToDate && <span className="bal-status">{textoSaldoCon(coowner.balance, coowner.user.name)}</span>}
          </span>
          {coowner.canSettle && (
            <button
              type="button"
              className="btn btn--sm"
              aria-label={`Saldar deuda con ${coowner.user.name}`}
              onClick={() => onSettle(coowner)}
            >
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
function SettleChoice({ name, monto, onTotal, onPartial, onCancel }) {
  const total = useRef(null)

  return (
    <Modal titulo={`Saldar deuda con ${name}`} subtitulo={`Deuda actual: ${fmtMoney(monto)}. ¿Pago de toda la deuda o de una parte?`} foco={total} onClose={onCancel}>
      <div className="bal-choice">
        <button ref={total} type="button" className="btn btn--primary" onClick={onTotal}>
          Pago total
        </button>
        <button type="button" className="btn" onClick={onPartial}>
          Pago parcial
        </button>
      </div>
      <ModalAcciones>
        <button type="button" className="btn" onClick={onCancel}>
          Cancelar
        </button>
      </ModalAcciones>
    </Modal>
  )
}

// Segundo paso del pago parcial: cuánto le pagaste. Solo pasa a confirmar si
// el monto es mayor a $0 y menor que la deuda vigente (owed).
function PartialAmountForm({ name, owed, initialValue, serverError, onSubmit, onCancel }) {
  const campo = useRef(null)
  const id = useId()
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState(serverError)

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
    <Modal titulo={`Pago parcial a ${name}`} foco={campo} onClose={onCancel}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="campo">
          <label className="lbl" htmlFor={`${id}-monto`}>
            Monto pagado
          </label>
          <div className="plata">
            <span aria-hidden="true">$</span>
            <input
              ref={campo}
              id={`${id}-monto`}
              className="in in--num"
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
            <FieldError id={`${id}-ayuda`}>{error}</FieldError>
          ) : (
            <p id={`${id}-ayuda`} className="hint campo__ayuda">
              Deuda actual: {fmtMoney(owed)}. El pago parcial tiene que ser menor; para saldar todo está el pago total.
            </p>
          )}
        </div>
        <ModalAcciones>
          <button type="button" className="btn" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" className="btn btn--primary">
            Continuar
          </button>
        </ModalAcciones>
      </form>
    </Modal>
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
          <svg className={open ? 'chev bal-caret is-open' : 'chev bal-caret'} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
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
        ? `El balance cambió mientras se confirmaba: la deuda ahora es de ${fmtMoney(err.currentAmount)}.`
        : err.message
      setSettling((actual) =>
        actual && { ...actual, busy: false, error, amount: err.currentAmount ?? actual.amount },
      )
    }
    setRecarga((n) => n + 1)
  }

  if (!configurado) {
    return <Vacio panel titulo="La sesión no está activa.">Ingresar de nuevo para continuar.</Vacio>
  }

  return (
    <section className="bal">
      {error && !data && (
        <ErrorCarga titulo="No se pudo cargar el balance." onReintentar={() => setRecarga((n) => n + 1)} />
      )}
      {error && data && (
        <p className="note bal-alert" role="alert">
          No se pudo actualizar el balance: {error}
        </p>
      )}

      {!data && !error && <Cargando filas={4}>Cargando balance…</Cargando>}

      {data && (
        <>
          <div className="bal-summary">
            <p className="bal-summary-label">Saldo total, sumando todos los meses</p>
            <p className={`bal-net bal-tone-${balanceStatus(data.net).tone}`}>{fmtSigned(data.net)}</p>
            <p className="bal-sub">{netSummary(data.net)}</p>
            <p className="hint">Movimientos muestra mes por mes; acá se suma todo y se descuentan los pagos entre integrantes.</p>
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

      {settling && (
        <>
          {settling.step === 'choice' && (
            <SettleChoice
              name={settling.user.name}
              monto={settling.amount}
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
                `¿Confirmar el pago de ${fmtMoney(settling.partial)} a ${settling.user.name}?`,
                `Queda una deuda de ${fmtMoney(settling.amount - settling.partial)}.`,
              ]}
              confirmLabel="Confirmar pago"
              tono="positivo"
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
                `¿Confirmar el pago de ${fmtMoney(settling.amount)} a ${settling.user.name}?`,
                `El balance con ${settling.user.name} pasa a $0 y el detalle queda guardado en Saldos cerrados.`,
              ]}
              confirmLabel="Confirmar pago"
              tono="positivo"
              busyLabel="Guardando…"
              busy={settling.busy}
              error={settling.error}
              onConfirm={confirmarPagoTotal}
              onCancel={() => setSettling(null)}
            />
          )}
        </>
      )}
    </section>
  )
}

export default Balance
