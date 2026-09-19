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
    },
    orderBy: { startDate: 'asc' },
  });
}

module.exports = { listForRange };
