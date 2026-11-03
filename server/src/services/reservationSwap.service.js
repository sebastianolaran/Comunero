const prisma = require('../prisma');
const { memberOf } = require('./membership');
const { swapProblem, requestedProblem } = require('./reservationSwap.rules');
const { TX_OPTIONS } = require('./rentalRequest.service');

const RESERVATION_SELECT = { id: true, assetId: true, userId: true, type: true, status: true, startDate: true, endDate: true };

const SWAP_SELECT = {
  id: true,
  status: true,
  closedReason: true,
  createdAt: true,
  resolvedAt: true,
  proposedBy: { select: { id: true, name: true } },
  recipient: { select: { id: true, name: true } },
  offered: { select: { id: true, startDate: true, endDate: true } },
  requested: { select: { id: true, startDate: true, endDate: true } },
};

const RESOLVED_SHOWN = 20;

const STALE_REASONS = {
  NOT_SWAPPABLE: 'Uno de los turnos se canceló',
  NOT_OWNER: 'Uno de los turnos cambió de dueño',
  SAME_USER: 'Uno de los turnos cambió de dueño',
  STARTED: 'Uno de los turnos ya empezó',
  DAYS_MISMATCH: 'Los turnos ya no tienen los mismos días',
};

// Mismo lock de bien que votar o cancelar un turno: así un turno no se cancela
// mientras se acepta un intercambio que lo incluye.
async function lockAsset(tx, assetId) {
  await tx.$queryRaw`SELECT id FROM "Asset" WHERE id = ${assetId} FOR UPDATE`;
}

function pendingWith(reservationIds) {
  return {
    status: 'PENDING',
    OR: [{ offeredReservationId: { in: reservationIds } }, { requestedReservationId: { in: reservationIds } }],
  };
}

// Pendientes primero (son las que piden una respuesta) y después las últimas resueltas.
// null si userId no es del bien.
async function list(assetId, userId) {
  const member = await prisma.user.findFirst({ where: { id: userId, ...memberOf(assetId) }, select: { id: true } });
  if (!member) return null;

  const [pending, resolved] = await Promise.all([
    prisma.reservationSwap.findMany({
      where: { assetId, status: 'PENDING' },
      select: SWAP_SELECT,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    }),
    prisma.reservationSwap.findMany({
      where: { assetId, status: { not: 'PENDING' } },
      select: SWAP_SELECT,
      orderBy: [{ resolvedAt: 'desc' }, { id: 'asc' }],
      take: RESOLVED_SHOWN,
    }),
  ]);
  return [...pending, ...resolved];
}

// Turnos de userId que se pueden ofrecer a cambio de requestedReservationId.
async function options({ userId, requestedReservationId, today }) {
  const requested = await prisma.reservation.findUnique({ where: { id: requestedReservationId }, select: RESERVATION_SELECT });
  if (!requested) return { error: 'NOT_FOUND' };
  const problem = requestedProblem({ requested, userId, today });
  if (problem) return { error: problem };

  const mine = await prisma.reservation.findMany({
    where: {
      assetId: requested.assetId,
      userId,
      type: 'USE',
      status: 'ACTIVE',
      startDate: { gt: today },
    },
    select: RESERVATION_SELECT,
    orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
  });

  const busy = await prisma.reservationSwap.findMany({
    where: pendingWith([requestedReservationId, ...mine.map((r) => r.id)]),
    select: { offeredReservationId: true, requestedReservationId: true },
  });
  const busyIds = new Set(busy.flatMap((s) => [s.offeredReservationId, s.requestedReservationId]));
  if (busyIds.has(requestedReservationId)) return { error: 'BUSY' };

  const reservations = mine
    .filter((offered) => !busyIds.has(offered.id) && !swapProblem({ offered, requested, proposerId: userId, today }))
    .map(({ id, startDate, endDate }) => ({ id, startDate, endDate }));
  return { reservations };
}

async function propose({ userId, offeredReservationId, requestedReservationId, today }) {
  return prisma.$transaction(async (tx) => {
    const offered = await tx.reservation.findUnique({ where: { id: offeredReservationId }, select: RESERVATION_SELECT });
    if (!offered) return { error: 'NOT_FOUND' };
    await lockAsset(tx, offered.assetId);

    const requested = await tx.reservation.findUnique({ where: { id: requestedReservationId }, select: RESERVATION_SELECT });
    if (!requested) return { error: 'NOT_FOUND' };

    const problem = swapProblem({ offered, requested, proposerId: userId, today });
    if (problem) return { error: problem };

    const busy = await tx.reservationSwap.count({ where: pendingWith([offered.id, requested.id]) });
    if (busy > 0) return { error: 'BUSY' };

    const swap = await tx.reservationSwap.create({
      data: {
        assetId: offered.assetId,
        offeredReservationId: offered.id,
        requestedReservationId: requested.id,
        proposedById: userId,
        recipientId: requested.userId,
      },
      select: SWAP_SELECT,
    });
    return { swap };
  }, TX_OPTIONS);
}

async function findPendingLocked(tx, swapId) {
  const found = await tx.reservationSwap.findUnique({ where: { id: swapId }, select: { assetId: true } });
  if (!found) return null;
  await lockAsset(tx, found.assetId);
  return tx.reservationSwap.findUnique({
    where: { id: swapId },
    select: { id: true, status: true, proposedById: true, recipientId: true, offeredReservationId: true, requestedReservationId: true },
  });
}

function close(tx, swapId, status, closedReason = null) {
  return tx.reservationSwap.update({
    where: { id: swapId },
    data: { status, closedReason, resolvedAt: new Date() },
    select: SWAP_SELECT,
  });
}

// Aceptar cruza los dueños de los dos turnos. Si alguno ya no se puede
// intercambiar, el intercambio queda sin efecto (CANCELLED con el motivo).
async function respond({ swapId, userId, value, today }) {
  return prisma.$transaction(async (tx) => {
    const swap = await findPendingLocked(tx, swapId);
    if (!swap) return { error: 'NOT_FOUND' };
    if (swap.recipientId !== userId) return { error: 'NOT_RECIPIENT' };
    if (swap.status !== 'PENDING') return { error: 'RESOLVED' };

    if (value === 'REJECT') return { swap: await close(tx, swapId, 'REJECTED') };

    const [offered, requested] = await Promise.all([
      tx.reservation.findUnique({ where: { id: swap.offeredReservationId }, select: RESERVATION_SELECT }),
      tx.reservation.findUnique({ where: { id: swap.requestedReservationId }, select: RESERVATION_SELECT }),
    ]);
    let problem = swapProblem({ offered, requested, proposerId: swap.proposedById, today });
    if (!problem && requested.userId !== swap.recipientId) problem = 'NOT_OWNER';
    if (problem) return { error: 'STALE', swap: await close(tx, swapId, 'CANCELLED', STALE_REASONS[problem]) };

    await tx.reservation.update({ where: { id: offered.id }, data: { userId: swap.recipientId } });
    await tx.reservation.update({ where: { id: requested.id }, data: { userId: swap.proposedById } });
    return { swap: await close(tx, swapId, 'ACCEPTED') };
  }, TX_OPTIONS);
}

async function cancel({ swapId, userId }) {
  return prisma.$transaction(async (tx) => {
    const swap = await findPendingLocked(tx, swapId);
    if (!swap) return { error: 'NOT_FOUND' };
    if (swap.proposedById !== userId) return { error: 'NOT_PROPOSER' };
    if (swap.status !== 'PENDING') return { error: 'RESOLVED' };
    return { swap: await close(tx, swapId, 'CANCELLED') };
  }, TX_OPTIONS);
}

module.exports = { list, options, propose, respond, cancel };
