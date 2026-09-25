// Acceso a la base para Balance. Solo queries de Prisma, sin reglas: la
// cuenta la hace balance.rules.js. Las lecturas que usa saldar reciben db (el
// cliente de la transaccion); si no, van contra prisma directo.

const prisma = require('../prisma');

const userName = { select: { id: true, name: true } };

async function assetExists(assetId) {
  return (await prisma.asset.count({ where: { id: assetId } })) > 0;
}

async function listCoowners(assetId) {
  return prisma.user.findMany({ where: { assetId }, select: userName.select, orderBy: { name: 'asc' } });
}

// Movimientos del bien en los que participa el usuario: los que pago o cobro
// y los que lo incluyen en el reparto. Los demas no pueden afectar su balance.
async function findMovementsOf(assetId, userId, db = prisma) {
  return db.movement.findMany({
    where: { assetId, OR: [{ paidById: userId }, { shares: { some: { userId } } }] },
    select: {
      id: true,
      type: true,
      description: true,
      amount: true,
      date: true,
      paidById: true,
      reservationId: true,
      paidBy: userName,
      shares: { select: { userId: true, amount: true } },
    },
    orderBy: [{ date: 'asc' }, { id: 'asc' }],
  });
}

// Pagos del bien que hizo o recibio el usuario, cerrados y parciales. Los
// cerrados traen los ids de los movimientos que se llevaron.
async function findSettlementsOf(assetId, userId, db = prisma) {
  return db.settlement.findMany({
    where: { assetId, OR: [{ fromUserId: userId }, { toUserId: userId }] },
    include: {
      fromUser: userName,
      toUser: userName,
      closedMovements: { select: { movementId: true } },
    },
    orderBy: [{ date: 'asc' }, { id: 'asc' }],
  });
}

// Corre fn(tx) en una transaccion Serializable: si dos cierres de la misma
// deuda llegan a la vez, uno falla (ver isSerializationFailure) en vez de
// guardar dos saldos cerrados. El timeout por defecto de Prisma (5 s) queda
// justo contra Neon: un cierre medido en local tardo ~3,5 s.
async function inTransaction(fn) {
  return prisma.$transaction(fn, { isolationLevel: 'Serializable', maxWait: 10_000, timeout: 15_000 });
}

const isSerializationFailure = (err) => err?.code === 'P2034';

// Guarda el saldo cerrado con la copia del detalle, lo vincula a los
// movimientos que se lleva y marca los pagos parciales que absorbe.
async function createClosing({ assetId, fromUserId, toUserId, amount, detail, movementIds, partialIds }, db) {
  const settlement = await db.settlement.create({
    data: {
      assetId,
      fromUserId,
      toUserId,
      amount,
      date: new Date(),
      closesBalance: true,
      detail,
      closedMovements: { create: movementIds.map((movementId) => ({ movementId })) },
    },
    include: { fromUser: userName, toUser: userName },
  });
  if (partialIds.length > 0) {
    await db.settlement.updateMany({
      where: { id: { in: partialIds }, assetId },
      data: { closedById: settlement.id },
    });
  }
  return settlement;
}

// Guarda un pago parcial con fecha de ahora. No cierra nada: queda en el
// periodo abierto hasta que un saldo cerrado lo absorba (closedById).
async function createPartialPayment({ assetId, fromUserId, toUserId, amount }, db) {
  return db.settlement.create({
    data: { assetId, fromUserId, toUserId, amount, date: new Date(), closesBalance: false },
    include: { fromUser: userName, toUser: userName },
  });
}

module.exports = {
  assetExists,
  listCoowners,
  findMovementsOf,
  findSettlementsOf,
  inTransaction,
  isSerializationFailure,
  createClosing,
  createPartialPayment,
};
