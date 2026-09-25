const prisma = require('../prisma');

// Se deriva de los votos (Approval = si, Objection = no) ademas del status,
// por si el status guardado no se actualizo al votar.
// Un alquiler cancelado se muestra como rechazado (con el motivo en rejectionReason).
function deriveStatus({ status, approvals, objections }, coownerCount) {
  if (status === 'CANCELLED' || status === 'REJECTED' || objections > 0) return 'REJECTED';
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
// blockedByOverlap: se pisa con una reserva aprobada, asi que no se puede votar.
function toListItem(reservation, coowners, userId, { blockedByOverlap = false } = {}) {
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
    paid: reservation.paidAt != null,
    rejectionReason: reservation.rejectionReason ?? null,
    blockedByOverlap,
    cancelled: reservation.status === 'CANCELLED',
  };
}

const LIST_SELECT = {
  id: true,
  status: true,
  startDate: true,
  endDate: true,
  note: true,
  amount: true,
  paidAt: true,
  rejectionReason: true,
  renter: { select: { name: true, phone: true } },
  approvals: { select: { userId: true } },
  objections: { select: { userId: true, reason: true }, orderBy: { createdAt: 'asc' } },
};

function coownersOf(db, assetId) {
  return db.user.findMany({ where: { assetId }, select: { id: true, name: true }, orderBy: { name: 'asc' } });
}

const OVERLAP_REASON = 'Rechazada por solapamiento con un alquiler aprobado en esas fechas';

// Otras reservas del bien que comparten al menos un dia con esta (inclusive en ambas puntas).
function overlapping({ id, assetId, startDate, endDate }, status) {
  return { assetId, id: { not: id }, status, startDate: { lte: endDate }, endDate: { gte: startDate } };
}

function sharesDays(a, b) {
  return a.id !== b.id && a.startDate <= b.endDate && a.endDate >= b.startDate;
}

// TODO: el userId tiene que salir de la sesion cuando exista el login.
async function listByAsset(assetId, userId) {
  const asset = await prisma.asset.findUnique({ where: { id: assetId }, select: { id: true } });
  if (!asset) return null;

  const [coowners, reservations, approved] = await Promise.all([
    coownersOf(prisma, assetId),
    prisma.reservation.findMany({
      where: { assetId, type: 'RENTAL' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: LIST_SELECT,
    }),
    // Cualquier tipo: un uso propio aprobado tambien ocupa los dias.
    prisma.reservation.findMany({
      where: { assetId, status: 'ACTIVE' },
      select: { id: true, startDate: true, endDate: true },
    }),
  ]);

  return reservations.map((r) =>
    toListItem(r, coowners, userId, {
      blockedByOverlap: r.status !== 'ACTIVE' && r.status !== 'CANCELLED' && approved.some((a) => sharesDays(a, r)),
    }),
  );
}

// Unanimidad literal: cuenta todos los copropietarios, no Asset.votesNeeded.
function nextStatus(value, approvals, coownerCount) {
  if (value === 'REJECT') return 'REJECTED';
  if (coownerCount > 0 && approvals >= coownerCount) return 'APPROVED';
  return 'PENDING';
}

const STORED_STATUS = { PENDING: 'PENDING', APPROVED: 'ACTIVE', REJECTED: 'REJECTED' };

// Rechazada no es final: cualquier copropietario puede votar o cambiar su voto.
function canVote({ status }) {
  return status !== 'APPROVED';
}

// Los defaults de Prisma (2s / 5s) se quedan cortos si Neon esta despertando.
const TX_OPTIONS = { maxWait: 10_000, timeout: 15_000 };

async function registerVote(tx, { reservationId, userId, value, reason }) {
  // Un rechazo de nuevo reemplaza el motivo anterior en vez de sumar otra objecion.
  await tx.objection.deleteMany({ where: { reservationId, userId } });
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

async function hasApprovedOverlap(tx, reservation) {
  return (await tx.reservation.count({ where: overlapping(reservation, 'ACTIVE') })) > 0;
}

// Al aprobarse, los pedidos pendientes que se pisan (uso propio u otras solicitudes) se rechazan solos.
async function rejectOverlapping(tx, reservation) {
  await tx.reservation.updateMany({
    where: overlapping(reservation, 'PENDING'),
    data: { status: 'REJECTED', rejectionReason: OVERLAP_REASON },
  });
}

// Lockea el bien y despues la reserva, siempre en ese orden: sin el lock del bien,
// dos solicitudes que se pisan podrian aprobarse a la vez; sin el de la reserva,
// un si y un no simultaneos podrian dejarla ACTIVE y con objecion.
async function lockForVote(tx, reservationId) {
  const found = await tx.reservation.findUnique({ where: { id: reservationId }, select: { assetId: true } });
  if (!found) return;
  await tx.$queryRaw`SELECT id FROM "Asset" WHERE id = ${found.assetId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "Reservation" WHERE id = ${reservationId} FOR UPDATE`;
}

// Devuelve { request } o { error: 'NOT_FOUND' | 'NOT_COOWNER' | 'CANCELLED' | 'RESOLVED' | 'OVERLAP' }.
async function vote({ reservationId, userId, value, reason }) {
  return prisma.$transaction(async (tx) => {
    await lockForVote(tx, reservationId);

    const select = { ...LIST_SELECT, assetId: true, type: true };
    const reservation = await tx.reservation.findUnique({ where: { id: reservationId }, select });
    if (!reservation || reservation.type !== 'RENTAL') return { error: 'NOT_FOUND' };

    const coowners = await coownersOf(tx, reservation.assetId);
    if (!coowners.some((u) => u.id === userId)) return { error: 'NOT_COOWNER' };
    // Cancelar libera los dias: para volver a alquilarlos se carga otra solicitud.
    if (reservation.status === 'CANCELLED') return { error: 'CANCELLED' };
    if (!canVote(toListItem(reservation, coowners, userId))) return { error: 'RESOLVED' };
    if (await hasApprovedOverlap(tx, reservation)) return { error: 'OVERLAP' };

    await registerVote(tx, { reservationId, userId, value, reason });

    // Se recalcula de cero: sacar la unica objecion la devuelve a PENDING (o la aprueba).
    const approvals = await tx.reservationApproval.count({ where: { reservationId } });
    const objections = await tx.objection.count({ where: { reservationId } });
    const status = deriveStatus({ status: 'PENDING', approvals, objections }, coowners.length);
    // Si estaba rechazada por solapamiento y ya no choca, el motivo del sistema deja de aplicar.
    await tx.reservation.update({
      where: { id: reservationId },
      data: { status: STORED_STATUS[status], rejectionReason: null },
    });
    if (status === 'APPROVED') await rejectOverlapping(tx, reservation);

    const updated = await tx.reservation.findUnique({ where: { id: reservationId }, select: LIST_SELECT });
    return { request: toListItem(updated, coowners, userId) };
  }, TX_OPTIONS);
}

function incomeFor(reservation, coowners, now) {
  const { renter, startDate, endDate } = reservation;
  return {
    assetId: reservation.assetId,
    reservationId: reservation.id,
    type: 'INCOME',
    amount: reservation.amount,
    description: `Alquiler a ${renter?.name ?? 'inquilino'} del ${toDateOnly(startDate)} al ${toDateOnly(endDate)}`,
    date: now,
    // Cobra quien gestiona el alquiler (quien lo cargo); el ingreso es de todos.
    paidById: reservation.userId,
    shares: { create: coowners.map((u) => ({ userId: u.id })) },
  };
}

// Devuelve { request } o { error: 'NOT_FOUND' | 'NOT_COOWNER' | 'NOT_APPROVED' | 'ALREADY_PAID' | 'NO_AMOUNT' }.
async function markPaid({ reservationId, userId, now = new Date() }) {
  return prisma.$transaction(async (tx) => {
    // Lockea la reserva: dos clicks simultaneos no pueden generar dos ingresos.
    await tx.$queryRaw`SELECT id FROM "Reservation" WHERE id = ${reservationId} FOR UPDATE`;

    const select = { ...LIST_SELECT, assetId: true, type: true, userId: true };
    const reservation = await tx.reservation.findUnique({ where: { id: reservationId }, select });
    if (!reservation || reservation.type !== 'RENTAL' || reservation.status === 'CANCELLED') {
      return { error: 'NOT_FOUND' };
    }

    const coowners = await coownersOf(tx, reservation.assetId);
    if (!coowners.some((u) => u.id === userId)) return { error: 'NOT_COOWNER' };
    const item = toListItem(reservation, coowners, userId);
    if (item.status !== 'APPROVED') return { error: 'NOT_APPROVED' };
    if (item.paid) return { error: 'ALREADY_PAID' };
    if (reservation.amount == null) return { error: 'NO_AMOUNT' };

    const updated = await tx.reservation.update({ where: { id: reservationId }, data: { paidAt: now }, select });
    await tx.movement.create({ data: incomeFor(reservation, coowners, now) });
    return { request: toListItem(updated, coowners, userId) };
  }, TX_OPTIONS);
}

// Devuelve { request } o { error: 'NOT_FOUND' | 'NOT_COOWNER' | 'NOT_APPROVED' | 'PAID' }.
async function cancel({ reservationId, userId }) {
  return prisma.$transaction(async (tx) => {
    // Mismo orden de locks que al votar: la cancelacion libera dias que otra votacion puede estar mirando.
    await lockForVote(tx, reservationId);

    const select = { ...LIST_SELECT, assetId: true, type: true };
    const reservation = await tx.reservation.findUnique({ where: { id: reservationId }, select });
    if (!reservation || reservation.type !== 'RENTAL' || reservation.status === 'CANCELLED') {
      return { error: 'NOT_FOUND' };
    }

    const coowners = await coownersOf(tx, reservation.assetId);
    const canceller = coowners.find((u) => u.id === userId);
    if (!canceller) return { error: 'NOT_COOWNER' };
    const item = toListItem(reservation, coowners, userId);
    if (item.status !== 'APPROVED') return { error: 'NOT_APPROVED' };
    if (item.paid) return { error: 'PAID' };

    const updated = await tx.reservation.update({
      where: { id: reservationId },
      data: { status: 'CANCELLED', rejectionReason: `Alquiler cancelado por ${canceller.name}` },
      select,
    });
    return { request: toListItem(updated, coowners, userId) };
  }, TX_OPTIONS);
}

// El telefono identifica al inquilino dentro del bien: si ya existe se reutiliza
// (con su nombre y su historial) en vez de crear un duplicado.
async function findOrCreateRenter(tx, { assetId, renterName, phone }) {
  const existing = await tx.renter.findFirst({
    where: { assetId, phone },
    orderBy: { id: 'asc' },
    select: { id: true },
  });
  if (existing) return existing;
  return tx.renter.create({ data: { assetId, name: renterName, phone }, select: { id: true } });
}

function toUtcDate(dateOnly) {
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

// Devuelve { request } o { error: 'ASSET_NOT_FOUND' | 'NOT_COOWNER' }.
async function create({ assetId, userId, renterName, phone, startDate, endDate, amount, comments }) {
  return prisma.$transaction(async (tx) => {
    const asset = await tx.asset.findUnique({ where: { id: assetId }, select: { id: true } });
    if (!asset) return { error: 'ASSET_NOT_FOUND' };
    // Mismo lock que al votar: con un solo copropietario el alta ya aprueba.
    await tx.$queryRaw`SELECT id FROM "Asset" WHERE id = ${assetId} FOR UPDATE`;

    const coowners = await coownersOf(tx, assetId);
    if (!coowners.some((u) => u.id === userId)) return { error: 'NOT_COOWNER' };

    const dates = { id: null, assetId, startDate: toUtcDate(startDate), endDate: toUtcDate(endDate) };
    // Se puede cargar aunque se pise con otras reservas, pero si choca con una
    // aprobada nace rechazada, igual que si hubiera existido antes de aprobarla.
    const blocked = await hasApprovedOverlap(tx, dates);
    const renter = await findOrCreateRenter(tx, { assetId, renterName, phone });
    // Quien la carga ya vota que si.
    const status = blocked ? 'REJECTED' : nextStatus('APPROVE', 1, coowners.length);
    const created = await tx.reservation.create({
      data: {
        assetId,
        userId,
        renterId: renter.id,
        type: 'RENTAL',
        status: STORED_STATUS[status],
        rejectionReason: blocked ? OVERLAP_REASON : null,
        startDate: dates.startDate,
        endDate: dates.endDate,
        amount,
        note: comments,
        approvals: { create: { userId } },
      },
      select: LIST_SELECT,
    });
    if (status === 'APPROVED') await rejectOverlapping(tx, { ...dates, id: created.id });
    return { request: toListItem(created, coowners, userId, { blockedByOverlap: blocked }) };
  }, TX_OPTIONS);
}

module.exports = { deriveStatus, toListItem, listByAsset, nextStatus, vote, create, markPaid, cancel };
