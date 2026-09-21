const prisma = require('../prisma');

// Historia "Solicitar alquiler a terceros", regla 4: si no existe un Renter
// con ese nombre para el asset, se crea. Simplificacion: se matchea solo
// por nombre (no hay todavia una forma de desambiguar dos terceros
// homonimos); si aparece ese caso se resuelve en una historia aparte.
async function findOrCreateRenter(assetId, name, phone) {
  const existente = await prisma.renter.findFirst({ where: { assetId, name } });
  if (existente) return existente;

  return prisma.renter.create({ data: { assetId, name, phone } });
}

// Crea la solicitud de alquiler (Reservation type=RENTAL, status PENDING) y
// el Movement de ingreso por el monto ya calculado, en una sola
// transaccion: no puede quedar una reserva de alquiler sin su movimiento
// (o viceversa).
async function requestRental({ assetId, userId, renterId, startDate, endDate, note, montoTotal, descripcionMovimiento }) {
  return prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.create({
      data: {
        assetId,
        userId,
        renterId,
        startDate,
        endDate,
        type: 'RENTAL',
        note,
      },
    });

    const movement = await tx.movement.create({
      data: {
        assetId,
        reservationId: reservation.id,
        type: 'INCOME',
        amount: montoTotal,
        description: descripcionMovimiento,
        date: startDate,
        paidById: userId,
      },
    });

    return { reservation, movement };
  });
}

module.exports = { findOrCreateRenter, requestRental };
