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
//
// Periodo abierto: lo que todavia no se llevo un saldo cerrado entre los dos.
// Un saldo cerrado marca los movimientos que cerro (closedMovements, por par
// de personas: el mismo movimiento puede seguir abierto con un tercero) y los
// pagos parciales que absorbio (closedById). No se corta por fecha: un
// movimiento cargado despues del cierre cuenta aunque tenga fecha anterior.

const { fromDateOnly } = require('./movement.rules');
const { forbidden, conflict } = require('../lib/httpError');

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

const closingsBetween = (settlements, a, b) =>
  settlements.filter((settlement) => settlement.closesBalance && isBetween(settlement, a, b));

// Fecha del ultimo saldo cerrado entre los dos (lo haya pagado cualquiera), o
// null si nunca cerraron.
function lastClosing(settlements, viewerId, otherId) {
  let last = null;
  for (const settlement of closingsBetween(settlements, viewerId, otherId)) {
    if (!last || settlement.date > last) last = settlement.date;
  }
  return last;
}

// Ids de los movimientos que ya se llevo algun saldo cerrado entre los dos.
function closedMovementIds(settlements, viewerId, otherId) {
  const ids = new Set();
  for (const settlement of closingsBetween(settlements, viewerId, otherId)) {
    for (const { movementId } of settlement.closedMovements ?? []) ids.add(movementId);
  }
  return ids;
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

const paymentDescription = (paidByViewer, other) =>
  paidByViewer ? `Pago parcial a ${other.name}` : `Pago parcial de ${other.name}`;

// Tu pago al otro achica tu deuda (+); el del otro a vos achica la suya (-).
function paymentEntry(settlement, viewerId, other) {
  const mine = settlement.fromUserId === viewerId;
  return {
    kind: 'PAYMENT',
    id: settlement.id,
    description: paymentDescription(mine, other),
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

// Balance del usuario con otro copropietario en el periodo abierto.
// movements y settlements pueden traer de mas: se filtran aca.
function computeBalanceWith(viewerId, other, movements, settlements) {
  const closing = lastClosing(settlements, viewerId, other.id);
  const closed = closedMovementIds(settlements, viewerId, other.id);

  const entries = [];
  for (const movement of movements) {
    if (closed.has(movement.id)) continue;
    const amount = movementEffect(movement, viewerId, other.id);
    if (amount !== null) entries.push(movementEntry(movement, amount));
  }

  let hasPartialPayments = false;
  for (const settlement of settlements) {
    if (settlement.closesBalance || settlement.closedById || !isBetween(settlement, viewerId, other.id)) continue;
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

// Pago total de la deuda del usuario (deudor) con other. amount es el monto
// que vio en el modal: si no es exactamente lo que debe ahora (se cargo algo
// en el medio), no se cierra y el 409 trae el monto actual.
// Devuelve lo que hay que guardar: el monto, que movimientos y pagos
// parciales se lleva, y la copia del detalle vista desde el deudor (los pagos
// parciales van como "Pago parcial": el texto depende de quien mire).
function buildClosing(viewerId, other, movements, settlements, amount) {
  const current = computeBalanceWith(viewerId, other, movements, settlements);
  if (current.balance > 0) throw forbidden('Solo quien debe puede saldar la deuda');
  if (current.balance === 0) throw conflict(`Ya estás al día con ${other.name}`);
  const owed = -current.balance;
  if (owed !== amount) {
    throw conflict(`El balance con ${other.name} cambió mientras confirmabas`, { currentAmount: owed });
  }

  const ofKind = (kind) => current.entries.filter((entry) => entry.kind === kind).map((entry) => entry.id);
  return {
    amount: owed,
    movementIds: ofKind('MOVEMENT'),
    partialIds: ofKind('PAYMENT'),
    detail: current.entries.map((entry) =>
      entry.kind === 'PAYMENT' ? { ...entry, description: 'Pago parcial' } : entry,
    ),
  };
}

// Un saldo cerrado como lo ve el usuario. El detalle se guardo desde el
// deudor; si mira el acreedor, los signos se invierten (0 - x para no dejar -0).
function closedSettlementView(settlement, viewerId, other) {
  const paidByMe = settlement.fromUserId === viewerId;
  const entries = (settlement.detail ?? []).map((entry) => ({
    ...entry,
    amount: paidByMe ? entry.amount : 0 - entry.amount,
    description:
      entry.kind === 'PAYMENT' ? paymentDescription(entry.paidBy.id === viewerId, other) : entry.description,
  }));
  return {
    id: settlement.id,
    date: fromDateOnly(settlement.date),
    amount: settlement.amount,
    paidByMe,
    fromUser: { id: settlement.fromUser.id, name: settlement.fromUser.name },
    toUser: { id: settlement.toUser.id, name: settlement.toUser.name },
    entries,
  };
}

// Saldos cerrados con esa persona, del mas nuevo al mas viejo.
function closedSettlementsWith(viewerId, other, settlements) {
  return closingsBetween(settlements, viewerId, other.id)
    .sort((a, b) => b.date - a.date)
    .map((settlement) => closedSettlementView(settlement, viewerId, other));
}

// Balance con cada uno de los demas copropietarios (tengan o no movimientos
// con vos), ordenados por nombre, con sus saldos cerrados, y el neto: la suma
// de todos.
function buildBalances(viewerId, coowners, movements, settlements) {
  const others = coowners
    .filter((coowner) => coowner.id !== viewerId)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const balances = others.map((other) => ({
    ...computeBalanceWith(viewerId, other, movements, settlements),
    closedSettlements: closedSettlementsWith(viewerId, other, settlements),
  }));
  return { net: balances.reduce((sum, b) => sum + b.balance, 0), coowners: balances };
}

module.exports = {
  movementEffect,
  lastClosing,
  computeBalanceWith,
  buildClosing,
  closedSettlementView,
  buildBalances,
};
