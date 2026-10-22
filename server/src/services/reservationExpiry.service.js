// Vencimiento de las reservas pendientes (uso propio y alquiler): pasado el
// tiempo para responder de Configuración, quien no votó cuenta según lo que eligió
// el bien. Corre cada hora (index.js) y al abrir las listas de pendientes.

const prisma = require('../prisma');
const rules = require('./reservationVoting.rules');
const { lockForVote, hasApprovedOverlap, rejectOverlapping, OVERLAP_REASON, TX_OPTIONS } = require('./rentalRequest.service');

// Mismo lock y mismas reglas de solapamiento que el voto. Devuelve 1 si la
// resolvió, 0 si ya no estaba pendiente (alguien votó o canceló en el medio).
async function expireOne(db, reservationId, action) {
  return db.$transaction(async (tx) => {
    await lockForVote(tx, reservationId);
    const reservation = await tx.reservation.findUnique({
      where: { id: reservationId },
      select: { id: true, assetId: true, status: true, startDate: true, endDate: true, _count: { select: { objections: true } } },
    });
    if (!reservation || reservation.status !== 'PENDING') return 0;

    let status = rules.expiredOutcome({ objections: reservation._count.objections, action });
    let rejectionReason = status === 'REJECTED' ? rules.EXPIRED_REASON : null;
    if (status === 'ACTIVE' && (await hasApprovedOverlap(tx, reservation))) {
      status = 'REJECTED';
      rejectionReason = OVERLAP_REASON;
    }

    await tx.reservation.update({ where: { id: reservationId }, data: { status, rejectionReason } });
    if (status === 'ACTIVE') await rejectOverlapping(tx, reservation);
    return 1;
  }, TX_OPTIONS);
}

// Resuelve las pendientes vencidas del bien, de la más vieja a la más nueva
// (una aprobada primero puede rechazar por solapamiento a otra). Devuelve cuántas.
async function expireForAsset(assetId, now = new Date(), db = prisma) {
  const asset = await db.asset.findUnique({ where: { id: assetId }, select: { responseHours: true, noResponseAction: true } });
  const limit = rules.expiryLimit(asset?.responseHours ?? null, now);
  if (!limit) return 0;

  const due = await db.reservation.findMany({
    where: { assetId, status: 'PENDING', createdAt: { lt: limit } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true },
  });
  let resolved = 0;
  for (const { id } of due) resolved += await expireOne(db, id, asset.noResponseAction);
  return resolved;
}

async function expireAll(now = new Date(), db = prisma) {
  const assets = await db.asset.findMany({ where: { responseHours: { not: null } }, select: { id: true } });
  for (const { id } of assets) await expireForAsset(id, now, db);
}

module.exports = { expireForAsset, expireAll };
