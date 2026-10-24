import { dayLabel, fmtMoney } from './movements.js'

// Textos de Balance. El server manda los montos con signo desde quien mira:
// positivo = saldo a favor de quien mira, negativo = en contra.

export function balanceStatus(balance) {
  if (balance > 0) return { text: 'A cobrar', tone: 'pos' }
  if (balance < 0) return { text: 'Por pagar', tone: 'neg' }
  return { text: 'Al día', tone: 'muted' }
}

// Con quién es el saldo, para que el monto diga hacia dónde va.
export function textoSaldoCon(balance, nombre) {
  if (balance > 0) return `A cobrar de ${nombre}`
  if (balance < 0) return `Por pagar a ${nombre}`
  return 'Al día'
}

export function netSummary(net) {
  if (net > 0) return 'En total, a cobrar'
  if (net < 0) return 'En total, por pagar'
  return 'Al día con todo el grupo'
}

// Quién pagó (gasto o pago entre ustedes) o cobró (alquiler) una línea del detalle.
export function entryWho(entry) {
  const cobro = entry.kind === 'MOVEMENT' && entry.type === 'INCOME'
  return `${cobro ? 'Cobró' : 'Pagó'} ${entry.paidBy.name}`
}

export function sinceLabel(since) {
  return since ? `Desde el saldo cerrado del ${dayLabel(since)}` : 'Sin saldos cerrados: desde el inicio'
}

// Quién le pagó a quién en un saldo cerrado, desde quien mira.
export function closedWho(settlement, otherName) {
  return settlement.paidByMe ? `Pago a ${otherName}` : `Pago de ${otherName}`
}

// Error del monto de un pago parcial (texto del campo) contra la deuda vigente
// (owed, positivo), o null si es válido. Mismas reglas que el server: mayor a
// $0 y menor que la deuda; si la cubre toda, va por el pago total.
export function partialAmountError(value, owed, otherName) {
  const text = String(value).trim()
  if (text === '') return 'Falta el monto del pago.'
  const amount = Number(text)
  if (!Number.isFinite(amount)) return 'El monto no es válido.'
  if (amount <= 0) return 'El monto tiene que ser mayor a $0.'
  if (!Number.isInteger(amount)) return 'El monto va en pesos, sin centavos.'
  if (amount === owed) return `Ese monto salda toda la deuda con ${otherName}: para eso está el pago total.`
  if (amount > owed) {
    return `El monto supera la deuda con ${otherName} (${fmtMoney(owed)}). Para saldar todo está el pago total.`
  }
  return null
}
