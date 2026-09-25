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
function toOpenDecision(decision, votesNeeded, myVote = null) {
  return {
    id: decision.id,
    title: decision.title,
    status: decision.status,
    createdAt: decision.createdAt.toISOString(),
    estimated: toEstimated(decision),
    yesVotes: decision._count.votes,
    votesNeeded,
    myVote,
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

// Propuestas en votación de un bien, con el voto de `userId` si viene.
// Devuelve null si el bien no existe.
async function listOpen(assetId, userId, db = prisma) {
  // Sin userId no se pide `votes`: un where con userId undefined traería los de todos.
  const ownVote = userId ? { votes: { where: { userId }, select: { value: true } } } : {};
  const asset = await db.asset.findUnique({
    where: { id: assetId },
    select: {
      votesNeeded: true,
      decisions: {
        where: { status: 'OPEN' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { ...OPEN_SELECT, ...ownVote },
      },
    },
  });
  if (!asset) return null;

  return asset.decisions.map((d) => toOpenDecision(d, asset.votesNeeded, d.votes?.[0]?.value ?? null));
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

const TX_OPTIONS = { maxWait: 10_000, timeout: 15_000 };

// Se cierra sola apenas el resultado está definido. Sin votos necesarios
// configurados no hay umbral contra el cual cerrarla.
function nextStatus({ yes, no, coowners, votesNeeded }) {
  if (votesNeeded == null) return 'OPEN';
  if (yes >= votesNeeded) return 'APPROVED';
  if (coowners - no < votesNeeded) return 'REJECTED';
  return 'OPEN';
}

function countVotes(votes) {
  return {
    yes: votes.filter((v) => v.value === 'YES').length,
    no: votes.filter((v) => v.value === 'NO').length,
  };
}

// Un voto por copropietario: votar de nuevo reemplaza el anterior.
async function vote({ decisionId, userId, value }, db = prisma) {
  return db.$transaction(async (tx) => {
    // Serializa los votos de la misma propuesta: sin esto, dos votos a la vez
    // pueden contar cada uno sin el otro y no cerrarla.
    await tx.$queryRaw`SELECT id FROM "Decision" WHERE id = ${decisionId} FOR UPDATE`;

    const decision = await tx.decision.findUnique({
      where: { id: decisionId },
      select: { status: true, asset: { select: { votesNeeded: true, users: { select: { id: true } } } } },
    });
    if (!decision) return { error: 'NOT_FOUND' };
    const { votesNeeded, users } = decision.asset;
    if (!users.some((u) => u.id === userId)) return { error: 'NOT_COOWNER' };
    if (decision.status !== 'OPEN') return { error: 'CLOSED' };

    await tx.vote.upsert({
      where: { decisionId_userId: { decisionId, userId } },
      create: { decisionId, userId, value },
      update: { value },
    });
    const votes = await tx.vote.findMany({ where: { decisionId }, select: { value: true } });
    const status = nextStatus({ ...countVotes(votes), coowners: users.length, votesNeeded });

    const updated = await tx.decision.update({
      where: { id: decisionId },
      data: status === 'OPEN' ? {} : { status, closedAt: new Date(), votesNeededAtClose: votesNeeded },
      select: { ...OPEN_SELECT, closedAt: true, votesNeededAtClose: true },
    });
    return {
      decision: status === 'OPEN' ? toOpenDecision(updated, votesNeeded, value) : toClosedDecision(updated),
    };
  }, TX_OPTIONS);
}

module.exports = { listClosed, listOpen, create, nextStatus, vote, CLOSED_STATUSES };
