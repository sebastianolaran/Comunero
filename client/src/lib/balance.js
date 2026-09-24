import { dayLabel } from './movements.js'

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
