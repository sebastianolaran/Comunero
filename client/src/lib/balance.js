import { dayLabel, fmtMoney } from './movements.js'

// Textos de Balance. El server manda los montos con signo desde quien mira:
// positivo = el otro te debe, negativo = vos le debés.

export function balanceStatus(balance) {
  if (balance > 0) return { text: 'Te debe', tone: 'pos' }
  if (balance < 0) return { text: 'Le debés', tone: 'neg' }
  return { text: 'Al día', tone: 'muted' }
}

export function netSummary(net) {
  if (net > 0) return 'En total te deben'
  if (net < 0) return 'En total debés'
  return 'Estás al día con todos'
}

// Quién pagó (gasto o pago entre ustedes) o cobró (alquiler) una línea del detalle.
export function entryWho(entry, meId) {
  const cobro = entry.kind === 'MOVEMENT' && entry.type === 'INCOME'
  if (entry.paidBy.id === meId) return cobro ? 'Cobraste vos' : 'Pagaste vos'
  return `${cobro ? 'Cobró' : 'Pagó'} ${entry.paidBy.name}`
}

export function sinceLabel(since) {
  return since ? `Desde el saldo cerrado del ${dayLabel(since)}` : 'Sin saldos cerrados: desde el inicio'
}

// Quién le pagó a quién en un saldo cerrado, desde quien mira.
export function closedWho(settlement, otherName) {
  return settlement.paidByMe ? `Le pagaste a ${otherName}` : `${otherName} te pagó`
}

// Error del monto de un pago parcial (texto del campo) contra la deuda vigente
// (owed, positivo), o null si es válido. Mismas reglas que el server: mayor a
// $0 y menor que la deuda; si la cubre toda, va por el pago total.
export function partialAmountError(value, owed, otherName) {
  const text = String(value).trim()
  if (text === '') return 'Ingresá cuánto le pagaste.'
  const amount = Number(text)
  if (!Number.isFinite(amount)) return 'Ingresá un monto válido.'
  if (amount <= 0) return 'El monto tiene que ser mayor a $0.'
  if (!Number.isInteger(amount)) return 'Ingresá el monto en pesos, sin centavos.'
  if (amount === owed) return `Ese monto es toda tu deuda con ${otherName}: para saldar todo usá el pago total.`
  if (amount > owed) {
    return `El monto supera tu deuda con ${otherName} (${fmtMoney(owed)}). Para saldar todo usá el pago total.`
  }
  return null
}
