import { useCallback, useEffect, useMemo, useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
import MovementModal from '../components/MovementModal'
import MovementsTable from '../components/MovementsTable'
import { ASSET_ID } from '../lib/currentAsset'
import { USER_ID } from '../lib/currentUser'
import { draftFromMovement, emptyDraft } from '../lib/movementDraft'
import {
  addMonths,
  deleteMessage,
  fmtMoney,
  fmtSigned,
  monthOptions,
  periodLabel,
  todayISO,
} from '../lib/movements'
import * as movementService from '../services/movement'
import './Movimientos.css'

const FILTERS = [
  { key: 'all', label: 'Todos', count: 'all', empty: 'movimientos' },
  { key: 'INCOME', label: 'Ingresos', count: 'income', empty: 'ingresos' },
  { key: 'EXPENSE', label: 'Egresos', count: 'expense', empty: 'egresos' },
]

const tone = (amount) => (amount > 0 ? 'pos' : amount < 0 ? 'neg' : 'muted')

function Movimientos() {
  const quien = useMemo(() => ({ assetId: ASSET_ID, userId: USER_ID }), [])
  const [coowners, setCoowners] = useState(null)
  const [periods, setPeriods] = useState(null) // { current, periods }
  const [period, setPeriod] = useState(null)
  const [filter, setFilter] = useState('all')
  const [data, setData] = useState(null) // { summary, counts, movements }
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(null) // { movementId, draft }
  const [toDelete, setToDelete] = useState(null) // { movement, busy, error }
  const [version, setVersion] = useState(0)
  const configurado = Boolean(ASSET_ID && USER_ID)

  useEffect(() => {
    if (!configurado) return undefined
    const controlador = new AbortController()
    movementService
      .fetchCoowners(quien, { signal: controlador.signal })
      .then(setCoowners)
      .catch((err) => !controlador.signal.aborted && setError(err.message))
    return () => controlador.abort()
  }, [quien, configurado])

  useEffect(() => {
    if (!configurado) return undefined
    let alive = true
    movementService
      .fetchPeriods(quien)
      .then((result) => {
        if (!alive) return
        setPeriods(result)
        setPeriod((current) => current ?? result.current)
      })
      .catch((err) => alive && setError(err.message))
    return () => {
      alive = false
    }
  }, [quien, configurado, version])

  useEffect(() => {
    if (!period) return undefined
    let alive = true
    movementService
      .fetchMovements(quien, { period, type: filter === 'all' ? undefined : filter })
      .then((result) => {
        if (!alive) return
        setData(result)
        setError(null)
      })
      .catch((err) => alive && setError(err.message))
    return () => {
      alive = false
    }
  }, [quien, period, filter, version])

  const closeModal = useCallback(() => setModal(null), [])
  const closeDelete = useCallback(() => setToDelete(null), [])
  const reload = () => setVersion((v) => v + 1)
  const coownerIds = coowners ? coowners.map((coowner) => coowner.id) : []

  const openCreate = () =>
    setModal({ movementId: null, draft: emptyDraft({ meId: USER_ID, coownerIds, today: todayISO() }) })
  const openEdit = (movement) => setModal({ movementId: movement.id, draft: draftFromMovement(movement) })

  // Un alta se muestra en su mes, por si se cargo en otro periodo. Una edicion
  // se queda en el mes que se estaba viendo: si se le cambio la fecha, sale
  // de esta lista y de este balance.
  const handleSaved = (saved) => {
    if (modal.movementId === null) setPeriod(saved.date.slice(0, 7))
    setModal(null)
    reload()
  }

  // Solo se borra al aceptar en el modal de confirmación; Cancelar lo cierra
  // sin tocar nada.
  async function confirmDelete() {
    const { movement } = toDelete
    setToDelete({ movement, busy: true, error: null })
    try {
      await movementService.deleteMovement(quien, movement.id)
      setToDelete(null)
      reload()
    } catch (err) {
      setToDelete({ movement, busy: false, error: err.message })
    }
  }

  if (!configurado) {
    return (
      <p className="aviso">
        Falta configurar <code>VITE_DEMO_ASSET_ID</code> y <code>VITE_DEMO_USER_ID</code> en{' '}
        <code>client/.env</code>.
      </p>
    )
  }

  const ready = coowners && periods && data
  const periodOptions = periods ? monthOptions([...periods.periods, period].filter(Boolean), periods.current) : []
  const filterDef = FILTERS.find((f) => f.key === filter)

  return (
    <section className="mov">
      <h1 className="mov-title">Movimientos</h1>

      {error && (
        <p className="mov-alert" role="alert">
          {error}
        </p>
      )}

      {!ready ? (
        !error && (
          <p className="mov-loading">
            Cargando movimientos… Si el backend estuvo inactivo, el primer pedido puede tardar hasta un minuto.
          </p>
        )
      ) : (
        <>
          <div className="mov-summary">
            <p className="mov-summary-label">{period === periods.current ? 'Este mes' : periodLabel(period)}</p>
            <p className={`mov-net mov-tone-${tone(data.summary.net)}`}>{fmtSigned(data.summary.net)}</p>
            <p className="mov-sub">
              Ingresos {fmtMoney(data.summary.income)} · Egresos {fmtMoney(data.summary.expense)}
            </p>
          </div>

          <div className="mov-toolbar">
            <div className="mov-pills" role="group" aria-label="Filtrar por tipo">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className="mov-pill"
                  aria-pressed={filter === f.key}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label} ({data.counts[f.count]})
                </button>
              ))}
            </div>
            <div className="mov-toolbar-right">
              <div className="mov-period-nav">
                <button
                  type="button"
                  className="mov-btn mov-btn-icon"
                  aria-label="Mes anterior"
                  disabled={period === periodOptions[periodOptions.length - 1]}
                  onClick={() => setPeriod(addMonths(period, -1))}
                >
                  ‹
                </button>
                <label className="mov-sr-only" htmlFor="mov-period">
                  Período
                </label>
                <select
                  id="mov-period"
                  className="mov-input mov-input-select"
                  value={period}
                  onChange={(event) => setPeriod(event.target.value)}
                >
                  {periodOptions.map((value) => (
                    <option key={value} value={value}>
                      {periodLabel(value)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="mov-btn mov-btn-icon"
                  aria-label="Mes siguiente"
                  disabled={period === periodOptions[0]}
                  onClick={() => setPeriod(addMonths(period, 1))}
                >
                  ›
                </button>
              </div>
              <button type="button" className="mov-btn mov-btn-primary" onClick={openCreate}>
                + Nuevo movimiento
              </button>
            </div>
          </div>

          <MovementsTable
            movements={data.movements}
            meId={USER_ID}
            emptyText={`No hay ${filterDef.empty} en ${periodLabel(period)}.`}
            onEdit={openEdit}
            onDelete={(movement) => setToDelete({ movement, busy: false, error: null })}
          />
        </>
      )}

      {modal && (
        <MovementModal
          key={modal.movementId ?? 'new'}
          movementId={modal.movementId}
          initialDraft={modal.draft}
          quien={quien}
          coowners={coowners}
          onCancel={closeModal}
          onSaved={handleSaved}
        />
      )}

      {toDelete && (
        <ConfirmDialog
          title="Eliminar movimiento"
          lines={deleteMessage(toDelete.movement)}
          confirmLabel="Eliminar"
          busyLabel="Eliminando…"
          busy={toDelete.busy}
          error={toDelete.error}
          onConfirm={confirmDelete}
          onCancel={closeDelete}
        />
      )}
    </section>
  )
}

export default Movimientos
