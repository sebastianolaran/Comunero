const prisma = require('../prisma');
const { nextStatus } = require('./rentalRequest.service');

// Los defaults de Prisma (2s / 5s) se quedan cortos si Neon esta despertando.
const TX_OPTIONS = { maxWait: 10_000, timeout: 15_000 };

// Historia "Solicitar alquiler a terceros", regla 4: si no existe un Renter
// con ese nombre para el asset, se crea. Simplificacion: se matchea solo
// por nombre (no hay todavia una forma de desambiguar dos terceros
// homonimos); si aparece ese caso se resuelve en una historia aparte.
async function findOrCreateRenter(assetId, name, phone) {
  const existente = await prisma.renter.findFirst({ where: { assetId, name } });
  if (existente) return existente;

  return prisma.renter.create({ data: { assetId, name, phone } });
}

// Crea la solicitud de alquiler (Reservation type=RENTAL) y el Movement de
// ingreso por el monto ya calculado, en una sola transaccion: no puede
// quedar una reserva de alquiler sin su movimiento (o viceversa).
//
// El monto va a los dos lados y no es redundante: en Reservation.amount es
// el monto pactado que se vota en Solicitudes, y en Movement es el ingreso
// registrado en la caja. Reservation.depositAmount es otra cosa (la seña).
async function requestRental({ assetId, userId, renterId, startDate, endDate, note, montoTotal, descripcionMovimiento }) {
  return prisma.$transaction(async (tx) => {
    // Quien la carga ya vota que si, igual que en /api/rental-requests: si es
    // el unico copropietario, su voto solo ya la deja aprobada.
    const coownerCount = await tx.user.count({ where: { assetId } });
    const aprobada = nextStatus('APPROVE', 1, coownerCount) === 'APPROVED';

    const reservation = await tx.reservation.create({
      data: {
        assetId,
        userId,
        renterId,
        startDate,
        endDate,
        type: 'RENTAL',
        status: aprobada ? 'ACTIVE' : 'PENDING',
        note,
        amount: montoTotal,
        approvals: { create: { userId } },
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
  }, TX_OPTIONS);
}

module.exports = { findOrCreateRenter, requestRental };
