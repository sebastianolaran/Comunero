const prisma = require('../prisma');

const CLOSED_STATUSES = ['APPROVED', 'REJECTED'];

function toClosedDecision(decision) {
  return {
    id: decision.id,
    title: decision.title,
    status: decision.status,
    closedAt: decision.closedAt?.toISOString() ?? null,
    estimated:
      decision.estimatedAmount == null
        ? null
        : { type: decision.estimatedType, amount: decision.estimatedAmount },
    yesVotes: decision._count.votes,
    // El del cierre, nunca Asset.votesNeeded: cambiar la configuración no
    // reescribe el historial.
    votesNeeded: decision.votesNeededAtClose,
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
          _count: { select: { votes: { where: { value: 'YES' } } } },
        },
      },
    },
  });
  if (!asset) return null;

  return asset.decisions.map(toClosedDecision);
}

module.exports = { listClosed, CLOSED_STATUSES };
