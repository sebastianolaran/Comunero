// Estado del formulario de alta/edicion de movimientos: armado inicial,
// validacion (los mismos limites que el server) y conversion al body de la API.
//
// El formulario siempre es una lista de items (nombre, monto y a quienes se
// divide cada uno). Con un solo item, el movimiento es ese item; con dos o mas
// se guarda desglosado y el monto es la suma.

export const MAX_DESCRIPTION = 100
const MAX_AMOUNT = 2147483647

let itemSeq = 0
function newItem(shareIds, description = '', amount = '') {
  itemSeq += 1
  return { key: `item-${itemSeq}`, description, amount, shareIds: [...shareIds] }
}

const idsOf = (shares) => shares.map((share) => share.userId)

export function emptyDraft({ meId, coownerIds, today }) {
  return {
    type: 'EXPENSE',
    description: '',
    date: today,
    paidById: meId ?? null,
    items: [newItem(coownerIds)],
    recurring: false,
  }
}

export function draftFromMovement(movement) {
  const hasItems = movement.items.length > 0
  return {
    type: movement.type,
    description: hasItems ? movement.description : '',
    date: movement.date,
    paidById: movement.paidBy.id,
    items: hasItems
      ? movement.items.map((item) => newItem(idsOf(item.shares), item.description, String(item.amount)))
      : [newItem(idsOf(movement.shares), movement.description, String(movement.amount))],
    recurring: movement.recurring,
  }
}

// El item nuevo arranca con el mismo reparto que el ultimo.
export function addItem(draft) {
  const last = draft.items[draft.items.length - 1]
  return { ...draft, items: [...draft.items, newItem(last ? last.shareIds : [])] }
}

// Siempre queda al menos un item.
export function removeItem(draft, key) {
  if (draft.items.length <= 1) return draft
  return { ...draft, items: draft.items.filter((item) => item.key !== key) }
}

export function updateItem(draft, key, patch) {
  return { ...draft, items: draft.items.map((item) => (item.key === key ? { ...item, ...patch } : item)) }
}

export function toggleId(ids, id) {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
}

// "15000", "15.000" o "$15.000" -> 15000. Cualquier otra cosa (decimales,
// negativos, cero, texto) -> null.
export function parseAmount(value) {
  const text = String(value ?? '')
    .trim()
    .replace(/^\$\s*/, '')
  if (!/^\d+$/.test(text) && !/^\d{1,3}(\.\d{3})+$/.test(text)) return null
  const amount = Number(text.replaceAll('.', ''))
  return amount > 0 && amount <= MAX_AMOUNT ? amount : null
}

// "Monto total": la suma de los montos validos cargados hasta ahora.
export function itemsTotal(items) {
  return items.reduce((sum, item) => sum + (parseAmount(item.amount) ?? 0), 0)
}

// Mismo reparto que el server: cada uno pone el monto dividido por la cantidad
// de personas, redondeado para abajo, y el resto queda para quien pago o cobro.
export function splitPreview(amountText, shareIds) {
  const amount = parseAmount(amountText)
  if (amount === null || shareIds.length === 0) return null
  const each = Math.floor(amount / shareIds.length)
  return { each, remainder: amount - each * shareIds.length }
}

// Descripcion que se usa para un desglose si no se escribe una: los nombres de
// los items, cortada al maximo permitido.
export function defaultDescription(items) {
  const text = items
    .map((item) => item.description.trim())
    .filter(Boolean)
    .join(', ')
  return text.length > MAX_DESCRIPTION ? `${text.slice(0, MAX_DESCRIPTION - 1)}…` : text
}

function isValidDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

const tooLong = (text) => text.trim().length > MAX_DESCRIPTION
const TOO_LONG = `No puede superar los ${MAX_DESCRIPTION} caracteres`
const INVALID_AMOUNT = 'El monto tiene que ser un número entero mayor a cero'

// Monto escrito que no se puede usar ("0", "15.00015.000", "abc"). Vacío no
// cuenta acá: eso es "obligatorio" y se marca recién al guardar.
const isInvalidAmount = (value) => String(value).trim() !== '' && parseAmount(value) === null

// Errores que se muestran mientras se escribe, antes de intentar guardar:
// solo los montos inválidos, para que no parezca que se aceptaron.
export function liveErrors(draft) {
  const errors = {}
  for (const item of draft.items) {
    if (isInvalidAmount(item.amount)) errors[`${item.key}.amount`] = INVALID_AMOUNT
  }
  return errors
}

// Devuelve { campo: mensaje } con los errores del borrador ({} si esta bien).
// Los campos de un item van como `${item.key}.description`, etc.
export function validateDraft(draft) {
  const errors = {}
  const isIncome = draft.type === 'INCOME'

  for (const item of draft.items) {
    if (!item.description.trim()) {
      errors[`${item.key}.description`] = isIncome ? 'El concepto es obligatorio' : 'El nombre del gasto es obligatorio'
    } else if (tooLong(item.description)) {
      errors[`${item.key}.description`] = TOO_LONG
    }

    if (!String(item.amount).trim()) errors[`${item.key}.amount`] = 'El monto es obligatorio'
    else if (isInvalidAmount(item.amount)) errors[`${item.key}.amount`] = INVALID_AMOUNT

    if (item.shareIds.length === 0) errors[`${item.key}.shareIds`] = 'Elegí al menos a una persona para dividir'
  }

  if (draft.items.length > 1) {
    if (tooLong(draft.description)) errors.description = TOO_LONG
    if (itemsTotal(draft.items) > MAX_AMOUNT) errors.total = 'El monto total es demasiado grande'
  }
  if (!isValidDay(draft.date)) errors.date = 'La fecha es obligatoria'
  if (draft.paidById === null) errors.paidById = isIncome ? 'Elegí quién cobró' : 'Elegí quién pagó'

  return errors
}

// Los ids son texto (cuid), igual que en el server: se ordenan como texto.
const sortIds = (ids) => [...ids].sort()

export function draftToPayload(draft) {
  const base = {
    type: draft.type,
    date: draft.date,
    paidById: draft.paidById,
    recurring: draft.recurring,
  }
  if (draft.items.length === 1) {
    const [item] = draft.items
    return {
      ...base,
      description: item.description.trim(),
      amount: parseAmount(item.amount),
      shareIds: sortIds(item.shareIds),
    }
  }
  return {
    ...base,
    description: draft.description.trim() || defaultDescription(draft.items),
    items: draft.items.map((item) => ({
      description: item.description.trim(),
      amount: parseAmount(item.amount),
      shareIds: sortIds(item.shareIds),
    })),
  }
}
