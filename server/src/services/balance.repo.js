// Acceso a la base para Balance. Solo queries de Prisma, sin reglas: la
// cuenta la hace balance.rules.js.

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
async function findMovementsOf(assetId, userId) {
  return prisma.movement.findMany({
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

// Pagos del bien que hizo o recibio el usuario, cerrados y parciales.
async function findSettlementsOf(assetId, userId) {
  return prisma.settlement.findMany({
    where: { assetId, OR: [{ fromUserId: userId }, { toUserId: userId }] },
    include: { fromUser: userName, toUser: userName },
    orderBy: [{ date: 'asc' }, { id: 'asc' }],
  });
}

module.exports = { assetExists, listCoowners, findMovementsOf, findSettlementsOf };
