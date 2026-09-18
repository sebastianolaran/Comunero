const prisma = require('../prisma');

// Se deriva de los votos (Approval = si, Objection = no) ademas del status,
// por si el status guardado no se actualizo al votar.
function deriveStatus({ status, approvals, objections }, coownerCount) {
  if (status === 'REJECTED' || objections > 0) return 'REJECTED';
  if (status === 'ACTIVE') return 'APPROVED';
  if (coownerCount > 0 && approvals >= coownerCount) return 'APPROVED';
  return 'PENDING';
}

// En UTC, para que el client no corra el dia por su zona horaria.
function toDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function toListItem(reservation, coownerCount) {
  const { approvals, objections } = reservation._count;
  return {
    id: reservation.id,
    renterName: reservation.renter?.name ?? null,
    startDate: toDateOnly(reservation.startDate),
    endDate: toDateOnly(reservation.endDate),
    yesCount: approvals,
    coownerCount,
    status: deriveStatus({ status: reservation.status, approvals, objections }, coownerCount),
  };
}

async function listByAsset(assetId) {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { _count: { select: { users: true } } },
  });
  if (!asset) return null;

  const reservations = await prisma.reservation.findMany({
    where: { assetId, type: 'RENTAL', status: { not: 'CANCELLED' } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      status: true,
      startDate: true,
      endDate: true,
      renter: { select: { name: true } },
      _count: { select: { approvals: true, objections: true } },
    },
  });

  return reservations.map((r) => toListItem(r, asset._count.users));
}

module.exports = { deriveStatus, toListItem, listByAsset };
