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

function myVoteOf({ approvals = [], objections = [] }) {
  if (objections.length > 0) return 'REJECT';
  if (approvals.length > 0) return 'APPROVE';
  return null;
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
    myVote: myVoteOf(reservation),
  };
}

const LIST_SELECT = {
  id: true,
  status: true,
  startDate: true,
  endDate: true,
  renter: { select: { name: true } },
  _count: { select: { approvals: true, objections: true } },
};

// TODO: el userId tiene que salir de la sesion cuando exista el login.
async function listByAsset(assetId, userId) {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { _count: { select: { users: true } } },
  });
  if (!asset) return null;

  const reservations = await prisma.reservation.findMany({
    where: { assetId, type: 'RENTAL', status: { not: 'CANCELLED' } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: userId
      ? {
          ...LIST_SELECT,
          approvals: { where: { userId }, select: { userId: true } },
          objections: { where: { userId }, select: { userId: true } },
        }
      : LIST_SELECT,
  });

  return reservations.map((r) => toListItem(r, asset._count.users));
}

// Unanimidad literal: cuenta todos los copropietarios, no Asset.votesNeeded.
function nextStatus(value, approvals, coownerCount) {
  if (value === 'REJECT') return 'REJECTED';
  if (coownerCount > 0 && approvals >= coownerCount) return 'APPROVED';
  return 'PENDING';
}

const STORED_STATUS = { APPROVED: 'ACTIVE', REJECTED: 'REJECTED' };

// Los defaults de Prisma (2s / 5s) se quedan cortos si Neon esta despertando.
const VOTE_TX_OPTIONS = { maxWait: 10_000, timeout: 15_000 };

async function registerVote(tx, { reservationId, userId, value, reason }) {
  if (value === 'APPROVE') {
    await tx.reservationApproval.upsert({
      where: { reservationId_userId: { reservationId, userId } },
      create: { reservationId, userId },
      update: {},
    });
    return;
  }
  await tx.reservationApproval.deleteMany({ where: { reservationId, userId } });
  await tx.objection.create({ data: { reservationId, userId, reason } });
}

// Devuelve { request } o { error: 'NOT_FOUND' | 'NOT_COOWNER' | 'RESOLVED' }.
async function vote({ reservationId, userId, value, reason }) {
  return prisma.$transaction(async (tx) => {
    // Lockea la reserva: sin esto, un si y un no simultaneos podrian dejarla
    // ACTIVE y con objecion a la vez.
    await tx.$queryRaw`SELECT id FROM "Reservation" WHERE id = ${reservationId} FOR UPDATE`;

    const select = { ...LIST_SELECT, assetId: true, type: true };
    const reservation = await tx.reservation.findUnique({ where: { id: reservationId }, select });
    if (!reservation || reservation.type !== 'RENTAL' || reservation.status === 'CANCELLED') {
      return { error: 'NOT_FOUND' };
    }

    const { assetId } = reservation;
    const voter = await tx.user.findFirst({ where: { id: userId, assetId }, select: { id: true } });
    if (!voter) return { error: 'NOT_COOWNER' };

    const coownerCount = await tx.user.count({ where: { assetId } });
    const { approvals, objections } = reservation._count;
    if (deriveStatus({ status: reservation.status, approvals, objections }, coownerCount) !== 'PENDING') {
      return { error: 'RESOLVED' };
    }

    await registerVote(tx, { reservationId, userId, value, reason });

    const approvalsAfter = await tx.reservationApproval.count({ where: { reservationId } });
    const status = nextStatus(value, approvalsAfter, coownerCount);
    if (status !== 'PENDING') {
      await tx.reservation.update({ where: { id: reservationId }, data: { status: STORED_STATUS[status] } });
    }

    const updated = await tx.reservation.findUnique({ where: { id: reservationId }, select: LIST_SELECT });
    return { request: { ...toListItem(updated, coownerCount), myVote: value } };
  }, VOTE_TX_OPTIONS);
}

module.exports = { deriveStatus, toListItem, listByAsset, nextStatus, vote };
