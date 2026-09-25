const prisma = require('../prisma');

const CLOSED_STATUSES = ['APPROVED', 'REJECTED'];

const YES_VOTES = { select: { votes: { where: { value: 'YES' } } } };

const OPEN_SELECT = {
  id: true,
  title: true,
  status: true,
  createdAt: true,
  estimatedType: true,
  estimatedAmount: true,
  _count: YES_VOTES,
};

function toEstimated(decision) {
  return decision.estimatedAmount == null
    ? null
    : { type: decision.estimatedType, amount: decision.estimatedAmount };
}

function toClosedDecision(decision) {
  return {
    id: decision.id,
    title: decision.title,
    status: decision.status,
    closedAt: decision.closedAt?.toISOString() ?? null,
    estimated: toEstimated(decision),
    yesVotes: decision._count.votes,
    // El del cierre, nunca Asset.votesNeeded: cambiar la configuración no
    // reescribe el historial.
    votesNeeded: decision.votesNeededAtClose,
  };
}

// Mientras está abierta, el denominador es la configuración vigente del bien.
function toOpenDecision(decision, votesNeeded) {
  return {
    id: decision.id,
    title: decision.title,
    status: decision.status,
    createdAt: decision.createdAt.toISOString(),
    estimated: toEstimated(decision),
    yesVotes: decision._count.votes,
    votesNeeded,
  };
}

// Historial de propuestas cerradas de un bien. `status` (APPROVED | REJECTED)
// es opcional; sin él trae las dos. Devuelve null si el bien no existe.
async function listClosed(assetId, { status } = {}, db = prisma) {
  const asset = await db.asset.findUnique({
    where: { id: assetId },
    select: {
      decisions: {
        where: { status: { in: status ? [status] : CLOSED_STATUSES } },
        // id desempata dos cierres en el mismo instante, para un orden estable.
        orderBy: [{ closedAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          title: true,
          status: true,
          closedAt: true,
          estimatedType: true,
          estimatedAmount: true,
          votesNeededAtClose: true,
          _count: YES_VOTES,
        },
      },
    },
  });
  if (!asset) return null;

  return asset.decisions.map(toClosedDecision);
}

// Propuestas en votación de un bien. Devuelve null si el bien no existe.
async function listOpen(assetId, db = prisma) {
  const asset = await db.asset.findUnique({
    where: { id: assetId },
    select: {
      votesNeeded: true,
      decisions: {
        where: { status: 'OPEN' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: OPEN_SELECT,
      },
    },
  });
  if (!asset) return null;

  return asset.decisions.map((d) => toOpenDecision(d, asset.votesNeeded));
}

// Arranca sin votos, tampoco el de quien la propone.
async function create({ assetId, userId, title, estimatedAmount }, db = prisma) {
  const asset = await db.asset.findUnique({
    where: { id: assetId },
    select: { votesNeeded: true, users: { where: { id: userId }, select: { id: true } } },
  });
  if (!asset) return { error: 'ASSET_NOT_FOUND' };
  if (asset.users.length === 0) return { error: 'NOT_COOWNER' };

  const created = await db.decision.create({
    data: {
      assetId,
      proposedById: userId,
      title,
      status: 'OPEN',
      // El modal no pide el tipo: toda propuesta nueva con monto es un gasto.
      estimatedType: estimatedAmount == null ? null : 'EXPENSE',
      estimatedAmount,
    },
    select: OPEN_SELECT,
  });
  return { decision: toOpenDecision(created, asset.votesNeeded) };
}

module.exports = { listClosed, listOpen, create, CLOSED_STATUSES };
