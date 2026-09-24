// Reglas de Balance que no tocan la base: cuanto le debe o le deben al usuario
// cada uno de los demas copropietarios, y el detalle que lo compone. Viven
// aparte de Prisma para testearlas sin base, y para que las historias de
// saldar (total y parcial) usen el mismo numero al validar cuanto se paga.
//
// Signo: positivo = el otro te debe a vos; negativo = vos le debes.
//
// La parte de cada persona en un movimiento es la que guardo Movimientos en
// MovementShare (hoy, partes iguales). Balance no la recalcula.
// TODO: repartir por porcentaje de propiedad cuando exista ese dato.

const { fromDateOnly } = require('./movement.rules');

// Lo que un movimiento suma o resta a tu balance con otro, o null si no lo
// afecta. Solo cuenta entre quien pago o cobro y cada otro participante:
//  pagaste un gasto          -> + la parte del otro
//  cobraste un alquiler      -> - la parte del otro (es plata del grupo)
//  el otro pago un gasto     -> - tu parte
//  el otro cobro un alquiler -> + tu parte
function movementEffect(movement, viewerId, otherId) {
  const partOf = (userId) => movement.shares.find((share) => share.userId === userId)?.amount;
  const sign = movement.type === 'EXPENSE' ? 1 : -1;

  if (movement.paidById === viewerId) {
    const part = partOf(otherId);
    return part === undefined ? null : sign * part;
  }
  if (movement.paidById === otherId) {
    const part = partOf(viewerId);
    return part === undefined ? null : -sign * part;
  }
  return null;
}

const isBetween = (settlement, a, b) =>
  (settlement.fromUserId === a && settlement.toUserId === b) ||
  (settlement.fromUserId === b && settlement.toUserId === a);

// Fecha del ultimo saldo cerrado entre los dos (lo haya pagado cualquiera), o
// null si nunca cerraron.
function lastClosing(settlements, viewerId, otherId) {
  let last = null;
  for (const settlement of settlements) {
    if (!settlement.closesBalance || !isBetween(settlement, viewerId, otherId)) continue;
    if (!last || settlement.date > last) last = settlement.date;
  }
  return last;
}

// Un movimiento es de un dia (medianoche UTC) y el cierre tiene hora: el
// periodo arranca el dia siguiente al del cierre, asi un movimiento del mismo
// dia que el cierre queda adentro de lo que ya se saldo.
function afterClosingDay(date, closing) {
  return !closing || fromDateOnly(date) > fromDateOnly(closing);
}

function movementEntry(movement, amount) {
  return {
    kind: 'MOVEMENT',
    id: movement.id,
    description: movement.description,
    date: fromDateOnly(movement.date),
    paidBy: { id: movement.paidBy.id, name: movement.paidBy.name },
    type: movement.type,
    total: movement.amount,
    amount,
    isRental: movement.type === 'INCOME' && Boolean(movement.reservationId),
  };
}

// Tu pago al otro achica tu deuda (+); el del otro a vos achica la suya (-).
function paymentEntry(settlement, viewerId, other) {
  const mine = settlement.fromUserId === viewerId;
  return {
    kind: 'PAYMENT',
    id: settlement.id,
    description: mine ? `Pago parcial a ${other.name}` : `Pago parcial de ${other.name}`,
    date: fromDateOnly(settlement.date),
    paidBy: { id: settlement.fromUser.id, name: settlement.fromUser.name },
    type: null,
    total: settlement.amount,
    amount: mine ? settlement.amount : -settlement.amount,
    isRental: false,
    at: settlement.date,
  };
}

// A igual dia, primero los movimientos y despues los pagos; entre pagos, por
// hora.
function byDate(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.kind !== b.kind) return a.kind === 'MOVEMENT' ? -1 : 1;
  if (a.at && b.at) return a.at - b.at;
  return 0;
}

// Balance del usuario con otro copropietario en el periodo vigente (desde el
// ultimo saldo cerrado entre los dos, o desde siempre). movements y
// settlements pueden traer de mas: se filtran aca.
function computeBalanceWith(viewerId, other, movements, settlements) {
  const closing = lastClosing(settlements, viewerId, other.id);

  const entries = [];
  for (const movement of movements) {
    if (!afterClosingDay(movement.date, closing)) continue;
    const amount = movementEffect(movement, viewerId, other.id);
    if (amount !== null) entries.push(movementEntry(movement, amount));
  }

  let hasPartialPayments = false;
  for (const settlement of settlements) {
    if (settlement.closesBalance || !isBetween(settlement, viewerId, other.id)) continue;
    if (closing && settlement.date <= closing) continue;
    entries.push(paymentEntry(settlement, viewerId, other));
    if (settlement.fromUserId === viewerId) hasPartialPayments = true;
  }

  entries.sort(byDate);
  const balance = entries.reduce((sum, entry) => sum + entry.amount, 0);

  return {
    user: { id: other.id, name: other.name },
    balance,
    upToDate: balance === 0,
    canSettle: balance < 0,
    hasPartialPayments,
    since: closing ? fromDateOnly(closing) : null,
    entries: entries.map(({ at, ...entry }) => entry),
  };
}

// Balance con cada uno de los demas copropietarios (tengan o no movimientos
// con vos), ordenados por nombre, y el neto: la suma de todos.
function buildBalances(viewerId, coowners, movements, settlements) {
  const others = coowners
    .filter((coowner) => coowner.id !== viewerId)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const balances = others.map((other) => computeBalanceWith(viewerId, other, movements, settlements));
  return { net: balances.reduce((sum, b) => sum + b.balance, 0), coowners: balances };
}

module.exports = { movementEffect, lastClosing, computeBalanceWith, buildBalances };
