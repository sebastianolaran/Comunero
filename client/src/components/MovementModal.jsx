import { useId, useState } from 'react'
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
import FieldError from './ui/FieldError'
import Modal, { ModalAcciones } from './ui/Modal'

const LABELS = {
  EXPENSE: {
    item: 'Nombre del gasto',
    placeholder: 'Ej: Compra supermercado',
    add: '+ Agregar gasto',
    one: 'gasto',
    payer: 'Pagado por',
  },
  INCOME: {
    item: 'Concepto',
    placeholder: 'Ej: Alquiler amigos',
    add: '+ Agregar concepto',
    one: 'concepto',
    payer: 'Cobrado por',
  },
}

function Field({ label, htmlFor, error, hint, children }) {
  return (
    <div className="campo">
      <label className="lbl" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && !error && <p className="hint campo__ayuda">{hint}</p>}
      <FieldError>{error}</FieldError>
    </div>
  )
}

function PeopleField({ legend, coowners, selected, onToggle, error, hint }) {
  return (
    <fieldset className="campo mov-personas">
      <legend className="lbl">{legend}</legend>
      <div>
        {coowners.map((coowner) => (
          <label key={coowner.id} className="chk">
            <input
              type="checkbox"
              checked={selected.includes(coowner.id)}
              onChange={() => onToggle(coowner.id)}
            />
            <span
              className="mov-dot"
              style={{ background: colorDeIntegrante(coowner.id, coowner.hue) }}
              aria-hidden="true"
            />
            {coowner.name}
          </label>
        ))}
      </div>
      {hint && !error && <p className="hint campo__ayuda">{hint}</p>}
      <FieldError>{error}</FieldError>
    </fieldset>
  )
}

// Se monta ya abierto. Escape y el clic afuera lo cierran sin guardar.
function MovementModal({ quien, movementId, initialDraft, coowners, onCancel, onSaved }) {
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

  return (
    <Modal titulo={isEdit ? 'Editar movimiento' : 'Nuevo movimiento'} onClose={onCancel}>
      <form onSubmit={handleSubmit} noValidate>

        <div className="seg seg--grow campo" role="group" aria-label="Tipo de movimiento">
          <button
            type="button"
            className={draft.type === 'EXPENSE' ? 'seg__b seg__b--on' : 'seg__b'}
            aria-pressed={draft.type === 'EXPENSE'}
            onClick={() => set({ type: 'EXPENSE' })}
          >
            Gasto
          </button>
          <button
            type="button"
            className={draft.type === 'INCOME' ? 'seg__b seg__b--on' : 'seg__b'}
            aria-pressed={draft.type === 'INCOME'}
            onClick={() => set({ type: 'INCOME' })}
          >
            Ingreso
          </button>
        </div>

        <div className="mov-items">
          <span className="lbl">{labels.item}</span>
          {draft.items.map((item, index) => {
            const n = index + 1
            const descriptionError = errors[`${item.key}.description`]
            const amountError = errors[`${item.key}.amount`]
            return (
              <div className="mov-item" key={item.key}>
                <div className="mov-item__fila">
                  <input
                    className="in"
                    aria-label={`${labels.item} ${n}`}
                    placeholder={labels.placeholder}
                    value={item.description}
                    aria-invalid={Boolean(descriptionError)}
                    autoFocus={!isEdit && index === 0}
                    onChange={(event) => setItem(item.key, { description: event.target.value })}
                  />
                  <div className="plata">
                    <span aria-hidden="true">$</span>
                    <input
                      className="in in--num"
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
                    className="btn btn--icon btn--bare"
                    aria-label={`Quitar ${labels.one} ${n}`}
                    title={`Quitar ${labels.one}`}
                    disabled={draft.items.length <= 1}
                    onClick={() => setDraft((d) => removeItem(d, item.key))}
                  >
                    <svg className="btn__i" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <FieldError>{descriptionError}</FieldError>
                <FieldError>{amountError}</FieldError>
                <PeopleField
                  legend={multi ? `Dividir entre (${labels.one} ${n})` : 'Dividir entre'}
                  coowners={coowners}
                  selected={item.shareIds}
                  onToggle={(id) => setItem(item.key, { shareIds: toggleId(item.shareIds, id) })}
                  error={errors[`${item.key}.shareIds`]}
                  hint={splitHint(splitPreview(item.amount, item.shareIds, coowners), { type: draft.type, payerName: payer?.name })}
                />
              </div>
            )
          })}
          <button type="button" className="btn btn--dash btn--sm campo" onClick={() => setDraft(addItem)}>
            {labels.add}
          </button>
        </div>

        <div className="mov-total">
          <span>Monto total</span>
          <strong aria-live="polite">{fmtMoney(itemsTotal(draft.items))}</strong>
        </div>
        <FieldError>{errors.total}</FieldError>

        {multi && (
          <Field
            label="Descripción (opcional)"
            htmlFor={`${uid}-description`}
            error={errors.description}
            hint={`Si la dejás vacía se usan los nombres. Hasta ${MAX_DESCRIPTION} caracteres.`}
          >
            <input
              id={`${uid}-description`}
              className="in"
              placeholder={defaultDescription(draft.items) || labels.placeholder}
              value={draft.description}
              aria-invalid={Boolean(errors.description)}
              onChange={(event) => set({ description: event.target.value })}
            />
          </Field>
        )}

        <div className="mov-fila">
          <Field label="Fecha" htmlFor={`${uid}-date`} error={errors.date}>
            <input
              id={`${uid}-date`}
              className="in"
              type="date"
              value={draft.date}
              aria-invalid={Boolean(errors.date)}
              onChange={(event) => set({ date: event.target.value })}
            />
          </Field>
          <Field label={labels.payer} htmlFor={`${uid}-paid-by`} error={errors.paidById}>
            <select
              id={`${uid}-paid-by`}
              className="sel mov-sel"
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

        <FieldError>{serverError ?? (hasErrors ? 'Revisá los campos marcados: son obligatorios.' : null)}</FieldError>

        <ModalAcciones>
          <button type="button" className="btn" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </ModalAcciones>
      </form>
    </Modal>
  )
}

export default MovementModal
