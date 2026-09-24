const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

// Pesos enteros con punto de miles: 48000 -> "$48.000".
export function fmtMoney(amount) {
  const digits = String(Math.abs(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${amount < 0 ? '-' : ''}$${digits}`
}

export function fmtSigned(amount) {
  if (amount > 0) return `+ ${fmtMoney(amount)}`
  if (amount < 0) return `- ${fmtMoney(-amount)}`
  return fmtMoney(0)
}

export function periodLabel(period) {
  const [year, month] = period.split('-')
  return `${MONTHS[Number(month) - 1]} ${year}`
}

export function dayLabel(day) {
  const [, month, date] = day.split('-')
  return `${date}/${month}`
}

// '2026-01' + (-2) -> '2025-11'.
export function addMonths(period, count) {
  const [year, month] = period.split('-').map(Number)
  const index = year * 12 + (month - 1) + count
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
}

// Opciones del selector de período, del más nuevo al más viejo y sin huecos:
// desde el mes con movimientos más viejo (o un año atrás, si es más viejo)
// hasta el más nuevo (o el actual). Así también se puede elegir un mes vacío.
export function monthOptions(periods, current) {
  const all = [...periods, current, addMonths(current, -12)].sort()
  const options = []
  for (let period = all[all.length - 1]; period >= all[0]; period = addMonths(period, -1)) {
    options.push(period)
  }
  return options
}

// Texto de la columna "Te toca" a partir del myPart que calcula el server.
export function myPartLabel({ kind, amount }) {
  switch (kind) {
    case 'OWED_TO_YOU':
      return { text: `+ ${fmtMoney(amount)}`, sub: 'te deben', tone: 'pos' }
    case 'YOU_OWE':
      return { text: `- ${fmtMoney(amount)}`, sub: 'debés', tone: 'neg' }
    case 'NO_DEBT':
      return { text: '—', sub: 'sin deudas', tone: 'muted' }
    default:
      return { text: '—', sub: 'no incluido', tone: 'muted' }
  }
}

// Quién le debe a quién por una parte del reparto, visto por el usuario actual.
// En un gasto los demás le deben a quien pagó; en un ingreso quien cobró le
// debe a cada uno su parte.
export function shareNote(movement, share, meId) {
  const payer = movement.paidBy
  if (share.userId === payer.id) return movement.type === 'INCOME' ? 'cobró' : 'pagó'
  const shareIsMe = share.userId === meId
  const payerIsMe = payer.id === meId
  if (movement.type === 'EXPENSE') {
    if (shareIsMe) return `le debés a ${payer.name}`
    return payerIsMe ? 'te debe' : `le debe a ${payer.name}`
  }
  if (shareIsMe) return `${payer.name} te debe`
  return payerIsMe ? 'le debés' : `${payer.name} le debe`
}

// Aclaración del reparto de un ítem mientras se carga: "$3.333 por persona" y,
// si la división no es exacta, para quién queda el resto.
export function splitHint(preview, { type, payerName }) {
  if (!preview) return null
  let text = `${fmtMoney(preview.each)} por persona`
  if (preview.remainder > 0 && payerName) {
    text += type === 'INCOME'
      ? ` · el resto (${fmtMoney(preview.remainder)}) queda para ${payerName}`
      : ` · el resto (${fmtMoney(preview.remainder)}) lo pone ${payerName}`
  }
  return text
}

// Texto del modal de confirmación para eliminar un movimiento.
export function deleteMessage(movement) {
  const month = periodLabel(movement.date.slice(0, 7))
  const lines = [
    `¿Eliminar "${movement.description}" por ${fmtMoney(movement.amount)}?`,
    `Se descuenta del balance de ${month}. No se puede deshacer.`,
  ]
  if (movement.recurring) {
    lines.push('Es recurrente: ya no se va a generar en los próximos meses. Los de meses anteriores quedan como están.')
  }
  return lines
}

// Hoy en la zona horaria del navegador, como AAAA-MM-DD.
export function todayISO(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}
