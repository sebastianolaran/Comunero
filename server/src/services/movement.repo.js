// Acceso a la base para Movimientos. Solo queries de Prisma, sin reglas:
// la validacion y el reparto vienen resueltos desde movement.service.js.

const prisma = require('../prisma');
const { memberOf } = require('./membership');
const { toDateOnly } = require('./movement.rules');

const userName = { select: { id: true, name: true } };

const movementInclude = {
  paidBy: userName,
  shares: { include: { user: userName }, orderBy: { userId: 'asc' } },
  items: {
    orderBy: { position: 'asc' },
    include: { shares: { include: { user: userName }, orderBy: { userId: 'asc' } } },
  },
};

// Campos del movimiento con su reparto e items como nested create: Prisma lo
// escribe todo en una sola transaccion, asi no queda un movimiento sin reparto.
function movementData(input, built) {
  return {
    type: input.type,
    amount: input.amount,
    description: input.description,
    date: toDateOnly(input.date),
    paidById: input.paidById,
    shares: { create: built.shares },
    items: {
      create: built.items.map((item) => ({
        position: item.position,
        description: item.description,
        amount: item.amount,
        shares: { create: item.shares },
      })),
    },
  };
}

async function assetExists(assetId) {
  return (await prisma.asset.count({ where: { id: assetId } })) > 0;
}

// Copropietarios del bien, en el orden en que se muestran.
async function listCoowners(assetId) {
  return prisma.user.findMany({ where: memberOf(assetId), select: userName.select, orderBy: { name: 'asc' } });
}

async function findMovementsInRange(assetId, range) {
  return prisma.movement.findMany({
    where: { assetId, date: range },
    include: movementInclude,
    orderBy: [{ date: 'asc' }, { id: 'asc' }],
  });
}

async function findDistinctPeriods(assetId) {
  const rows = await prisma.$queryRaw`
    SELECT DISTINCT to_char("date", 'YYYY-MM') AS period
    FROM "Movement"
    WHERE "assetId" = ${assetId}`;
  return rows.map((row) => row.period);
}

async function findMovement(assetId, id) {
  return prisma.movement.findFirst({ where: { id, assetId }, include: movementInclude });
}

async function insertMovement(assetId, input, built) {
  return prisma.movement.create({
    data: { assetId, ...movementData(input, built) },
    include: movementInclude,
  });
}

// Reemplaza el movimiento completo: borra el reparto y los items anteriores
// (los repartos de cada item caen en cascada) y crea los nuevos. Devuelve null si el movimiento ya no existe.
async function replaceMovement(id, input, built) {
  const data = movementData(input, built);
  try {
    return await prisma.movement.update({
      where: { id },
      data: {
        ...data,
        shares: { deleteMany: {}, ...data.shares },
        items: { deleteMany: {}, ...data.items },
      },
      include: movementInclude,
    });
  } catch (err) {
    if (err.code === 'P2025') return null;
    throw err;
  }
}

// Devuelve cuantos borro (0 si no existia o es de otro bien).
async function removeMovement(assetId, id) {
  const { count } = await prisma.movement.deleteMany({ where: { id, assetId } });
  return count;
}

module.exports = {
  assetExists,
  listCoowners,
  findMovementsInRange,
  findDistinctPeriods,
  findMovement,
  insertMovement,
  replaceMovement,
  removeMovement,
};
