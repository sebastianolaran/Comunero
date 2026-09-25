// Casos de uso de Balance. Recibe viewer = { assetId, userId }: el bien y
// quien mira, que es desde donde se calcula quien le debe a quien.
// TODO: cuando exista el login, viewer tiene que salir de la sesion.

const repo = require('./balance.repo');
const rules = require('./balance.rules');
// Modulo entero (no destructuring) para poder mockearlo en los tests.
const movementService = require('./movement.service');
const { badRequest, conflict, forbidden, notFound } = require('../lib/httpError');

// { net, coowners }: el balance con cada uno de los demas copropietarios del
// bien, con su detalle y sus saldos cerrados, y el neto. Falla si el bien no
// existe o si quien pide no es copropietario.
async function getBalances({ assetId, userId }) {
  if (!(await repo.assetExists(assetId))) throw notFound('No existe el bien');
  const coowners = await repo.listCoowners(assetId);
  if (!coowners.some((coowner) => coowner.id === userId)) {
    throw forbidden('Solo los copropietarios del bien pueden ver su balance');
  }

  // Igual que al abrir Movimientos: sin esto, un recurrente del mes podria no
  // estar generado todavia y faltaria en el balance hasta la pasada horaria.
  await movementService.generateDueRecurrences(assetId);
  const [movements, settlements] = await Promise.all([
    repo.findMovementsOf(assetId, userId),
    repo.findSettlementsOf(assetId, userId),
  ]);
  return rules.buildBalances(userId, coowners, movements, settlements);
}

// Lo comun a los pagos (total y parcial) de fromUserId a toUserId: chequea
// que los dos sean copropietarios del bien y corre
// save(tx, payee, movements, settlements) en una transaccion, con el balance
// recalculado adentro para validar contra la deuda vigente al confirmar.
async function payInTransaction({ assetId, fromUserId, toUserId }, save) {
  if (fromUserId === toUserId) throw badRequest('No podés saldar una deuda con vos mismo');
  if (!(await repo.assetExists(assetId))) throw notFound('No existe el bien');
  const coowners = await repo.listCoowners(assetId);
  const payee = coowners.find((coowner) => coowner.id === toUserId);
  if (!payee || !coowners.some((coowner) => coowner.id === fromUserId)) {
    throw forbidden('Solo los copropietarios del bien pueden saldar deudas entre ellos');
  }

  // Mismo numero que vio en Balance, que tambien genera los pendientes.
  await movementService.generateDueRecurrences(assetId);
  try {
    return await repo.inTransaction(async (tx) => {
      const movements = await repo.findMovementsOf(assetId, fromUserId, tx);
      const settlements = await repo.findSettlementsOf(assetId, fromUserId, tx);
      return save(tx, payee, movements, settlements);
    });
  } catch (err) {
    if (repo.isSerializationFailure(err)) {
      throw conflict(`El balance con ${payee.name} cambió mientras confirmabas. Volvé a intentar`);
    }
    throw err;
  }
}

// Pago total: fromUserId (quien pide, y tiene que ser el deudor) le salda
// toda la deuda a toUserId. amount es el monto que vio en el modal; si
// coincide con la deuda vigente, guarda el saldo cerrado. Devuelve el saldo
// cerrado visto por quien pago.
async function closeBalance({ assetId, fromUserId, toUserId, amount }) {
  return payInTransaction({ assetId, fromUserId, toUserId }, async (tx, payee, movements, settlements) => {
    const closing = rules.buildClosing(fromUserId, payee, movements, settlements, amount);
    const settlement = await repo.createClosing({ assetId, fromUserId, toUserId, ...closing }, tx);
    return rules.closedSettlementView(settlement, fromUserId, payee);
  });
}

// Pago parcial: fromUserId (el deudor) le paga amount a toUserId, que tiene
// que ser menos que la deuda vigente. No cierra nada: el pago queda en el
// periodo abierto de los dos. Devuelve { payment, remaining }: el pago visto
// por quien pago y lo que le queda debiendo.
async function payPartial({ assetId, fromUserId, toUserId, amount }) {
  return payInTransaction({ assetId, fromUserId, toUserId }, async (tx, payee, movements, settlements) => {
    const { remaining } = rules.buildPartialPayment(fromUserId, payee, movements, settlements, amount);
    const settlement = await repo.createPartialPayment({ assetId, fromUserId, toUserId, amount }, tx);
    return { payment: rules.partialPaymentView(settlement, fromUserId, payee), remaining };
  });
}

module.exports = { getBalances, closeBalance, payPartial };
