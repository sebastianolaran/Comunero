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

function voteValue(userId, approvedBy, rejectedBy) {
  if (rejectedBy.has(userId)) return 'REJECT';
  if (approvedBy.has(userId)) return 'APPROVE';
  return null;
}

// coowners: [{ id, name }] del bien, en el orden en que se muestran.
function toListItem(reservation, coowners, userId) {
  const { approvals, objections } = reservation;
  const approvedBy = new Set(approvals.map((a) => a.userId));
  const rejectedBy = new Set(objections.map((o) => o.userId));
  const nameById = new Map(coowners.map((u) => [u.id, u.name]));
  const votes = coowners.map((u) => ({
    userId: u.id,
    name: u.name,
    value: voteValue(u.id, approvedBy, rejectedBy),
  }));

  return {
    id: reservation.id,
    renterName: reservation.renter?.name ?? null,
    renterPhone: reservation.renter?.phone ?? null,
    comments: reservation.note ?? null,
    amount: reservation.amount ?? null,
    startDate: toDateOnly(reservation.startDate),
    endDate: toDateOnly(reservation.endDate),
    yesCount: approvals.length,
    coownerCount: coowners.length,
    status: deriveStatus(
      { status: reservation.status, approvals: approvals.length, objections: objections.length },
      coowners.length,
    ),
    votes,
    rejections: objections.map((o) => ({ name: nameById.get(o.userId) ?? null, reason: o.reason })),
    vote: userId ? voteValue(userId, approvedBy, rejectedBy) : null,
  };
}

const LIST_SELECT = {
  id: true,
  status: true,
  startDate: true,
  endDate: true,
  note: true,
  amount: true,
  renter: { select: { name: true, phone: true } },
  approvals: { select: { userId: true } },
  objections: { select: { userId: true, reason: true }, orderBy: { createdAt: 'asc' } },
};

function coownersOf(db, assetId) {
  return db.user.findMany({ where: { assetId }, select: { id: true, name: true }, orderBy: { name: 'asc' } });
}

// TODO: el userId tiene que salir de la sesion cuando exista el login.
async function listByAsset(assetId, userId) {
  const asset = await prisma.asset.findUnique({ where: { id: assetId }, select: { id: true } });
  if (!asset) return null;

  const [coowners, reservations] = await Promise.all([
    coownersOf(prisma, assetId),
    prisma.reservation.findMany({
      where: { assetId, type: 'RENTAL', status: { not: 'CANCELLED' } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: LIST_SELECT,
    }),
  ]);

  return reservations.map((r) => toListItem(r, coowners, userId));
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

    const coowners = await coownersOf(tx, reservation.assetId);
    if (!coowners.some((u) => u.id === userId)) return { error: 'NOT_COOWNER' };
    if (toListItem(reservation, coowners).status !== 'PENDING') return { error: 'RESOLVED' };

    await registerVote(tx, { reservationId, userId, value, reason });

    const approvalsAfter = await tx.reservationApproval.count({ where: { reservationId } });
    const status = nextStatus(value, approvalsAfter, coowners.length);
    if (status !== 'PENDING') {
      await tx.reservation.update({ where: { id: reservationId }, data: { status: STORED_STATUS[status] } });
    }

    const updated = await tx.reservation.findUnique({ where: { id: reservationId }, select: LIST_SELECT });
    return { request: toListItem(updated, coowners, userId) };
  }, VOTE_TX_OPTIONS);
}

module.exports = { deriveStatus, toListItem, listByAsset, nextStatus, vote };
