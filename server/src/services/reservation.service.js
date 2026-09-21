const prisma = require('../prisma');

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
      user: { select: { name: true } },
    },
    orderBy: { startDate: 'asc' },
  });
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

// Crea la solicitud de uso propio. Queda en PENDING (default del schema):
// regla 5, "al confirmar la solicitud, los dias quedan pendientes de
// confirmacion" se refiere a este alta, no a un paso posterior.
async function requestUse({ assetId, userId, startDate, endDate, note }) {
  return prisma.reservation.create({
    data: {
      assetId,
      userId,
      startDate,
      endDate,
      note,
      type: 'USE',
    },
  });
}

module.exports = { listForRange, hasOverlap, requestUse };
