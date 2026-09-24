import { useEffect, useId, useRef, useState } from 'react'
import { colorDeIntegrante } from '../lib/calendar'
import {
  MAX_DESCRIPTION,
  addItem,
  defaultDescription,
  draftToPayload,
  itemsTotal,
  liveErrors,
  removeItem,
  splitPreview,
  toggleId,
  updateItem,
  validateDraft,
} from '../lib/movementDraft'
import { fmtMoney, splitHint } from '../lib/movements'
import * as movementService from '../services/movement'

const LABELS = {
  EXPENSE: {
    item: 'Nombre del gasto',
    placeholder: 'Ej: Compra supermercado',
    add: '+ Agregar gasto',
    one: 'gasto',
    payer: 'Pagado por',
    recurring: 'Es un gasto recurrente',
  },
  INCOME: {
    item: 'Concepto',
    placeholder: 'Ej: Alquiler amigos',
    add: '+ Agregar concepto',
    one: 'concepto',
    payer: 'Cobrado por',
    recurring: 'Es un ingreso recurrente',
  },
}

function Field({ label, htmlFor, error, hint, children }) {
  return (
    <div className={`mov-field${error ? ' is-error' : ''}`}>
      <label className="mov-field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && !error && <p className="mov-field-hint">{hint}</p>}
      {error && <p className="mov-field-error">{error}</p>}
    </div>
  )
}

function PeopleField({ legend, coowners, selected, onToggle, error, hint }) {
  return (
    <fieldset className={`mov-field${error ? ' is-error' : ''}`}>
      <legend className="mov-field-label">{legend}</legend>
      <div className="mov-people">
        {coowners.map((coowner) => (
          <label key={coowner.id} className="mov-person">
            <input
              type="checkbox"
              checked={selected.includes(coowner.id)}
              onChange={() => onToggle(coowner.id)}
            />
            <span
              className="mov-person-dot"
              style={{ background: colorDeIntegrante(coowner.id) }}
              aria-hidden="true"
            />
            {coowner.name}
          </label>
        ))}
      </div>
      {hint && !error && <p className="mov-field-hint">{hint}</p>}
      {error && <p className="mov-field-error">{error}</p>}
    </fieldset>
  )
}

// Se monta ya abierto. Escape y el clic afuera lo cierran sin guardar, igual
// que el modal de Alquiler.
function MovementModal({ quien, movementId, initialDraft, coowners, onCancel, onSaved }) {
  const dialogo = useRef(null)
  const [draft, setDraft] = useState(initialDraft)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState(null)
  const uid = useId()

  const isEdit = movementId !== null && movementId !== undefined
  // Un monto invalido se marca mientras se escribe; el resto de los errores
  // aparece al intentar guardar y despues se actualiza mientras se corrige.
  const errors = submitted ? validateDraft(draft) : liveErrors(draft)
  const hasErrors = submitted && Object.keys(errors).length > 0
  const labels = LABELS[draft.type]
  const payer = coowners.find((coowner) => coowner.id === draft.paidById)
  const multi = draft.items.length > 1

  useEffect(() => {
    dialogo.current.showModal()
  }, [])

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))
  const setItem = (key, patch) => setDraft((d) => updateItem(d, key, patch))

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitted(true)
    setServerError(null)
    if (Object.keys(validateDraft(draft)).length > 0) return

    setSaving(true)
    try {
      const movimiento = draftToPayload(draft)
      const saved = isEdit
        ? await movementService.updateMovement(quien, movementId, movimiento)
        : await movementService.createMovement(quien, movimiento)
      onSaved(saved)
    } catch (err) {
      setServerError(err.message)
      setSaving(false)
    }
  }

  let recurringHint = null
  if (draft.recurring) {
    recurringHint = 'Se genera solo el 1° de cada mes siguiente, con el mismo monto y reparto.'
  } else if (isEdit && initialDraft.recurring) {
    recurringHint = 'Este movimiento se mantiene, pero ya no se va a generar en los próximos meses.'
  }

  return (
    <dialog
      ref={dialogo}
      className="mov-modal"
      aria-labelledby={`${uid}-title`}
      onClose={onCancel}
      onClick={(event) => {
        if (event.target === dialogo.current) onCancel()
      }}
    >
      <form className="mov-modal-form" onSubmit={handleSubmit} noValidate>
        <h2 id={`${uid}-title`} className="mov-modal-title">
          {isEdit ? 'Editar movimiento' : 'Nuevo movimiento'}
        </h2>

        <div className="mov-segmented" role="group" aria-label="Tipo de movimiento">
          <button type="button" aria-pressed={draft.type === 'EXPENSE'} onClick={() => set({ type: 'EXPENSE' })}>
            Gasto
          </button>
          <button type="button" aria-pressed={draft.type === 'INCOME'} onClick={() => set({ type: 'INCOME' })}>
            Ingreso
          </button>
        </div>

        <div className="mov-items">
          <span className="mov-field-label">{labels.item}</span>
          {draft.items.map((item, index) => {
            const n = index + 1
            const descriptionError = errors[`${item.key}.description`]
            const amountError = errors[`${item.key}.amount`]
            return (
              <div className="mov-item-card" key={item.key}>
                <div className="mov-item-row">
                  <input
                    className="mov-input"
                    aria-label={`${labels.item} ${n}`}
                    placeholder={labels.placeholder}
                    value={item.description}
                    aria-invalid={Boolean(descriptionError)}
                    autoFocus={!isEdit && index === 0}
                    onChange={(event) => setItem(item.key, { description: event.target.value })}
                  />
                  <div className="mov-money-input mov-item-amount">
                    <span aria-hidden="true">$</span>
                    <input
                      className="mov-input"
                      aria-label={`Monto ${n}`}
                      inputMode="numeric"
                      placeholder="0"
                      value={item.amount}
                      aria-invalid={Boolean(amountError)}
                      onChange={(event) => setItem(item.key, { amount: event.target.value })}
                    />
                  </div>
                  <button
                    type="button"
                    className="mov-icon-btn"
                    aria-label={`Quitar ${labels.one} ${n}`}
                    title={`Quitar ${labels.one}`}
                    disabled={draft.items.length <= 1}
                    onClick={() => setDraft((d) => removeItem(d, item.key))}
                  >
                    ×
                  </button>
                </div>
                {descriptionError && <p className="mov-field-error">{descriptionError}</p>}
                {amountError && <p className="mov-field-error">{amountError}</p>}
                <PeopleField
                  legend={multi ? `Dividir entre (${labels.one} ${n})` : 'Dividir entre'}
                  coowners={coowners}
                  selected={item.shareIds}
                  onToggle={(id) => setItem(item.key, { shareIds: toggleId(item.shareIds, id) })}
                  error={errors[`${item.key}.shareIds`]}
                  hint={splitHint(splitPreview(item.amount, item.shareIds), { type: draft.type, payerName: payer?.name })}
                />
              </div>
            )
          })}
          <button type="button" className="mov-add-btn" onClick={() => setDraft(addItem)}>
            {labels.add}
          </button>
        </div>

        <div className="mov-total-row">
          <span>Monto total</span>
          <strong aria-live="polite">{fmtMoney(itemsTotal(draft.items))}</strong>
        </div>
        {errors.total && <p className="mov-field-error">{errors.total}</p>}

        {multi && (
          <Field
            label="Descripción (opcional)"
            htmlFor={`${uid}-description`}
            error={errors.description}
            hint={`Si la dejás vacía se usan los nombres. Hasta ${MAX_DESCRIPTION} caracteres.`}
          >
            <input
              id={`${uid}-description`}
              className="mov-input"
              placeholder={defaultDescription(draft.items) || labels.placeholder}
              value={draft.description}
              aria-invalid={Boolean(errors.description)}
              onChange={(event) => set({ description: event.target.value })}
            />
          </Field>
        )}

        <div className="mov-field-row">
          <Field label="Fecha" htmlFor={`${uid}-date`} error={errors.date}>
            <input
              id={`${uid}-date`}
              className="mov-input"
              type="date"
              value={draft.date}
              aria-invalid={Boolean(errors.date)}
              onChange={(event) => set({ date: event.target.value })}
            />
          </Field>
          <Field label={labels.payer} htmlFor={`${uid}-paid-by`} error={errors.paidById}>
            <select
              id={`${uid}-paid-by`}
              className="mov-input"
              value={draft.paidById ?? ''}
              aria-invalid={Boolean(errors.paidById)}
              onChange={(event) => set({ paidById: event.target.value === '' ? null : event.target.value })}
            >
              {draft.paidById === null && <option value="">Elegí…</option>}
              {coowners.map((coowner) => (
                <option key={coowner.id} value={coowner.id}>
                  {coowner.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="mov-field">
          <label className="mov-check">
            <input
              type="checkbox"
              checked={draft.recurring}
              onChange={(event) => set({ recurring: event.target.checked })}
            />
            {labels.recurring}
          </label>
          {recurringHint && <p className="mov-field-hint">{recurringHint}</p>}
        </div>

        {(serverError || hasErrors) && (
          <p className="mov-form-error" role="alert">
            {serverError ?? 'Revisá los campos marcados: son obligatorios.'}
          </p>
        )}

        <div className="mov-modal-actions">
          <button type="button" className="mov-btn" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" className="mov-btn mov-btn-primary" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </dialog>
  )
}

export default MovementModal
