// TODO: el userId tiene que salir de la sesion, como en el resto de la API.

const prisma = require('../prisma');
const rules = require('./asset.rules');
const { memberOf } = require('./membership');
const { todayInArgentina } = require('../validation/newRentalRequest');
const { resolveHues } = require('./assetSettings.rules');
// Modulo entero (no destructuring) para poder mockearlo en los tests.
const settingsService = require('./assetSettings.service');

const CODE_ATTEMPTS = 5;

function cardSelect(today) {
  return {
    id: true,
    name: true,
    inviteCode: true,
    users: { select: { id: true, name: true }, orderBy: { name: 'asc' } },
    reservations: {
      where: {
        OR: [{ status: 'PENDING' }, { status: 'ACTIVE', endDate: { gte: new Date(`${today}T00:00:00.000Z`) } }],
      },
      select: {
        type: true,
        status: true,
        userId: true,
        startDate: true,
        endDate: true,
        user: { select: { name: true } },
        approvals: { select: { userId: true } },
        objections: { select: { userId: true } },
      },
    },
    decisions: { where: { status: 'OPEN' }, select: { votes: { select: { userId: true } } } },
  };
}

function toCard(asset, userId, today) {
  const hues = resolveHues(asset.users.map((u) => u.id));
  return rules.toCard(
    {
      ...asset,
      users: asset.users.map((u) => ({ ...u, hue: hues[u.id] })),
      reservations: asset.reservations.map((r) => ({
        type: r.type,
        status: r.status,
        userId: r.userId,
        userName: r.user.name,
        startDate: rules.toDay(r.startDate),
        endDate: rules.toDay(r.endDate),
        approvals: r.approvals.map((a) => a.userId),
        objections: r.objections.map((o) => o.userId),
      })),
      decisions: asset.decisions.map((d) => ({ voters: d.votes.map((v) => v.userId) })),
    },
    userId,
    today,
  );
}

async function userExists(db, userId) {
  return (await db.user.count({ where: { id: userId } })) > 0;
}

async function cardOf(db, assetId, userId, today = todayInArgentina()) {
  const asset = await db.asset.findUnique({ where: { id: assetId }, select: cardSelect(today) });
  return toCard(asset, userId, today);
}

const collator = new Intl.Collator('es', { sensitivity: 'base' });

// null si el usuario no existe.
async function listForUser(userId, db = prisma, today = todayInArgentina()) {
  if (!(await userExists(db, userId))) return null;
  const assets = await db.asset.findMany({
    where: { users: { some: { id: userId } } },
    select: cardSelect(today),
  });
  return assets
    .map((asset) => toCard(asset, userId, today))
    .sort((a, b) => collator.compare(a.name, b.name) || (a.id < b.id ? -1 : 1));
}

const isUniqueViolation = (err) => err?.code === 'P2002';

// Bien y creador en una sola escritura: nunca queda un bien sin copropietarios.
async function create({ userId, name }, db = prisma, random = Math.random) {
  if (!(await userExists(db, userId))) return { error: 'USER_NOT_FOUND' };

  for (let attempt = 1; ; attempt += 1) {
    try {
      const created = await db.asset.create({
        data: {
          name,
          inviteCode: rules.generateInviteCode(name, random),
          users: { connect: { id: userId } },
        },
        select: { id: true },
      });
      return { asset: await cardOf(db, created.id, userId) };
    } catch (err) {
      if (!isUniqueViolation(err) || attempt >= CODE_ATTEMPTS) throw err;
    }
  }
}

// Sin votación. Si ya era copropietario no cambia nada.
async function join({ userId, code }, db = prisma) {
  if (!(await userExists(db, userId))) return { error: 'USER_NOT_FOUND' };
  const inviteCode = rules.normalizeInviteCode(code);
  if (!inviteCode) return { error: 'CODE_NOT_FOUND' };

  const asset = await db.asset.findUnique({ where: { inviteCode }, select: { id: true } });
  if (!asset) return { error: 'CODE_NOT_FOUND' };

  const alreadyMember = (await db.user.count({ where: { id: userId, ...memberOf(asset.id) } })) > 0;
  if (!alreadyMember) {
    // Con alguien nuevo los porcentajes ya no suman 100: el reparto vuelve a
    // partes iguales solo, y queda en los cambios de Configuración.
    const percents = await settingsService.percentsOf(asset.id, db);
    await db.asset.update({ where: { id: asset.id }, data: { users: { connect: { id: userId } } } });
    if (percents) {
      await db.activityLog.create({
        data: {
          assetId: asset.id,
          userId,
          type: settingsService.LOG_TYPE,
          payload: { changes: [{ field: 'percents', from: percents, to: null, reason: 'MEMBER_JOINED' }] },
        },
      });
    }
  }
  return { asset: await cardOf(db, asset.id, userId), alreadyMember };
}

module.exports = { listForUser, create, join };
