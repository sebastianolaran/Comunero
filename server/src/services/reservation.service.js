const prisma = require('../prisma');

function estadoDeVotacion(afirmativos, negativos, total) {
  if (afirmativos > total / 2) return 'ACTIVE';

  const pendientes = total - afirmativos - negativos;
  if (afirmativos + pendientes <= total / 2) return 'REJECTED';
  return 'PENDING';
}

// Historia "Consultar calendario": trae solo las reservas que se solapan
// con el rango pedido (un mes), no todo el historico del asset.
//
// - Se excluyen las canceladas: una reserva cancelada equivale a que el
//   dia nunca fue pedido, no debe pintarse.
// - El solapamiento es por fecha (inclusive en ambas puntas): una reserva
//   "toca" el rango si arranca antes de que termine el rango y termina
//   despues de que arranca el rango.
async function listForRange(assetId, rangeStart, rangeEnd) {
  return prisma.reservation.findMany({
    where: {
      assetId,
      status: { not: 'CANCELLED' },
      startDate: { lte: rangeEnd },
      endDate: { gte: rangeStart },
    },
    select: {
      id: true,
      userId: true,
      renterId: true,
      startDate: true,
      endDate: true,
      type: true,
      status: true,
      amount: true,
      user: { select: { name: true } },
      renter: { select: { name: true, phone: true } },
      tasks: {
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          name: true,
          completed: true,
          assignedTo: { select: { id: true, name: true } },
        },
      },
      approvals: { select: { userId: true } },
      objections: { select: { userId: true } },
      asset: { select: { users: { select: { id: true } } } },
    },
    orderBy: { startDate: 'asc' },
  }).then((reservations) =>
    reservations.map(({ approvals, objections, asset, ...reservation }) => ({
      ...reservation,
      approvalCount: approvals.length,
      objectionCount: objections.length,
      coownerCount: asset.users.length,
    })),
  );
}

async function listPendingUse(assetId) {
  const reservations = await prisma.reservation.findMany({
    where: { assetId, type: 'USE', status: 'PENDING' },
    select: {
      id: true,
      userId: true,
      startDate: true,
      endDate: true,
      type: true,
      status: true,
      user: { select: { name: true } },
      approvals: { select: { userId: true } },
      asset: { select: { users: { select: { id: true } } } },
    },
    orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
  });

  return reservations.map(({ approvals, asset, ...reservation }) => ({
    ...reservation,
    approvalCount: approvals.length,
    coownerCount: asset.users.length,
  }));
}

// Historia "Solicitar turno de uso propio", regla 3: no se puede solicitar
// un turno que incluya dias ya ocupados por otra reserva ACTIVE o PENDING
// (una reserva REJECTED o CANCELLED no ocupa el dia, no bloquea).
async function hasOverlap(assetId, startDate, endDate) {
  const count = await prisma.reservation.count({
    where: {
      assetId,
      status: { in: ['ACTIVE', 'PENDING'] },
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
  });
  return count > 0;
}

// Crea la solicitud de uso propio. El creador suma su voto afirmativo y la
// reserva queda ACTIVE solo si ese voto ya alcanza la mayoria; si no, queda
// PENDING hasta que voten los demas copropietarios.
async function requestUse({ assetId, userId, startDate, endDate, note }) {
  return prisma.$transaction(async (tx) => {
    const asset = await tx.asset.findUnique({
      where: { id: assetId },
      select: { users: { select: { id: true } } },
    });
    if (!asset || !asset.users.some((user) => user.id === userId)) return null;

    const status = estadoDeVotacion(1, 0, asset.users.length);
    return tx.reservation.create({
      data: {
        assetId,
        userId,
        startDate,
        endDate,
        note,
        type: 'USE',
        status,
        approvals: { create: { userId } },
      },
    });
  });
}

async function voteUse({ reservationId, userId, value }) {
  return prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({
      where: { id: reservationId },
      select: {
        id: true,
        assetId: true,
        type: true,
        status: true,
        approvals: { select: { userId: true } },
        objections: { select: { userId: true } },
      },
    });
    if (!reservation || reservation.type !== 'USE') return { error: 'NOT_FOUND' };
    if (reservation.status === 'CANCELLED') return { error: 'CANCELLED' };

    const coowners = await tx.user.findMany({ where: { assetId: reservation.assetId }, select: { id: true } });
    if (!coowners.some((user) => user.id === userId)) return { error: 'NOT_COOWNER' };

    await tx.objection.deleteMany({ where: { reservationId, userId } });
    if (value === 'APPROVE') {
      await tx.reservationApproval.upsert({
        where: { reservationId_userId: { reservationId, userId } },
        create: { reservationId, userId },
        update: {},
      });
    } else {
      await tx.reservationApproval.deleteMany({ where: { reservationId, userId } });
      await tx.objection.create({ data: { reservationId, userId } });
    }

    const approvals = await tx.reservationApproval.count({ where: { reservationId } });
    const objections = await tx.objection.count({ where: { reservationId } });
    const status = estadoDeVotacion(approvals, objections, coowners.length);
    const updated = await tx.reservation.update({ where: { id: reservationId }, data: { status } });
    return { reservation: updated };
  });
}

module.exports = { listForRange, listPendingUse, hasOverlap, requestUse, voteUse };
