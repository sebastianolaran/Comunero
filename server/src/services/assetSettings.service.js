// Configuración del bien. Cualquier copropietario la cambia sin votación, pero
// cada cambio queda en ActivityLog con quién lo hizo y el antes y el después.
// TODO: el userId tiene que salir de la sesion, como en el resto de la API.

const prisma = require('../prisma');
const rules = require('./assetSettings.rules');

const LOG_TYPE = 'SETTINGS_CHANGED';
const RECENT_CHANGES = 20;
// Los defaults de Prisma (2s / 5s) se quedan cortos si Neon esta despertando.
const TX_OPTIONS = { maxWait: 10_000, timeout: 15_000 };

const SELECT = {
  rentalDailyRate: true,
  maxConsecutiveDays: true,
  responseHours: true,
  noResponseAction: true,
  users: { select: { id: true, name: true }, orderBy: { name: 'asc' } },
  memberSettings: { select: { userId: true, percent: true, hue: true } },
  activityLogs: {
    where: { type: LOG_TYPE },
    // id desempata dos cambios en el mismo instante, para un orden estable.
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: RECENT_CHANGES,
    select: { id: true, createdAt: true, payload: true, user: { select: { id: true, name: true } } },
  },
};

function storedBy(asset, key) {
  return Object.fromEntries(asset.memberSettings.map((s) => [s.userId, s[key]]));
}

// Valores efectivos: los porcentajes en null si se reparte en partes iguales y
// un color para cada integrante, lo haya elegido o no.
function effective(asset) {
  const ids = asset.users.map((u) => u.id);
  return {
    ...Object.fromEntries(rules.ASSET_FIELDS.map((field) => [field, asset[field]])),
    percents: rules.resolvePercents(ids, storedBy(asset, 'percent')),
    hues: rules.resolveHues(ids, storedBy(asset, 'hue')),
  };
}

function toView(asset) {
  const { percents, hues, ...numbers } = effective(asset);
  return {
    ...numbers,
    members: asset.users.map((u) => ({ id: u.id, name: u.name, percent: percents?.[u.id] ?? null, hue: hues[u.id] })),
    palette: rules.MEMBER_HUES,
    changes: asset.activityLogs.map((log) => ({
      id: log.id,
      createdAt: log.createdAt.toISOString(),
      user: { id: log.user.id, name: log.user.name },
      changes: log.payload.changes,
    })),
  };
}

async function load(db, assetId, userId) {
  const asset = await db.asset.findUnique({ where: { id: assetId }, select: SELECT });
  if (!asset) return { error: 'ASSET_NOT_FOUND' };
  if (!asset.users.some((u) => u.id === userId)) return { error: 'NOT_COOWNER' };
  return { asset };
}

// Color de cada integrante del bien (userId -> tono), con la misma regla que la
// pantalla de Configuración: el calendario, las tarjetas y Movimientos lo usan.
async function huesOf(assetId, db = prisma) {
  const asset = await db.asset.findUnique({
    where: { id: assetId },
    select: { users: { select: { id: true } }, memberSettings: { select: { userId: true, hue: true } } },
  });
  if (!asset) return {};
  return rules.resolveHues(asset.users.map((u) => u.id), storedBy(asset, 'hue'));
}

// Porcentaje de cada integrante (userId -> %), o null si se reparte en partes
// iguales: así lo usan el reparto de movimientos y el ingreso de un alquiler.
async function percentsOf(assetId, db = prisma) {
  const asset = await db.asset.findUnique({
    where: { id: assetId },
    select: { users: { select: { id: true } }, memberSettings: { select: { userId: true, percent: true } } },
  });
  if (!asset) return null;
  return rules.resolvePercents(asset.users.map((u) => u.id), storedBy(asset, 'percent'));
}

// Devuelve { settings } o { error: 'ASSET_NOT_FOUND' | 'NOT_COOWNER' }.
async function getSettings({ assetId, userId }, db = prisma) {
  const { asset, error } = await load(db, assetId, userId);
  if (error) return { error };
  return { settings: toView(asset) };
}

async function saveMembers(tx, assetId, changes) {
  if ('percents' in changes) {
    if (changes.percents === null) {
      await tx.assetMemberSetting.updateMany({ where: { assetId }, data: { percent: null } });
    } else {
      for (const [userId, percent] of Object.entries(changes.percents)) {
        await tx.assetMemberSetting.upsert({
          where: { assetId_userId: { assetId, userId } },
          create: { assetId, userId, percent },
          update: { percent },
        });
      }
    }
  }
  for (const [userId, hue] of Object.entries(changes.hues ?? {})) {
    await tx.assetMemberSetting.upsert({
      where: { assetId_userId: { assetId, userId } },
      create: { assetId, userId, hue },
      update: { hue },
    });
  }
}

// Devuelve { settings } o { error: 'ASSET_NOT_FOUND' | 'NOT_COOWNER' } o
// { error: 'INVALID', field, message }.
async function updateSettings({ assetId, userId, body }, db = prisma) {
  return db.$transaction(async (tx) => {
    // Serializa los cambios del mismo bien: sin esto, dos colores elegidos a la
    // vez podrían quedar repetidos.
    await tx.$queryRaw`SELECT id FROM "Asset" WHERE id = ${assetId} FOR UPDATE`;
    const { asset, error } = await load(tx, assetId, userId);
    if (error) return { error };

    const parsed = rules.parseSettingsInput(body, asset.users.map((u) => u.id));
    if (parsed.error) return { error: 'INVALID', field: parsed.field, message: parsed.error };

    // Un color elegido no puede ser el que hoy tiene otro integrante.
    const before = effective(asset);
    const changes = parsed.value.hues ? { ...parsed.value, hues: { ...before.hues, ...parsed.value.hues } } : parsed.value;
    if (changes.hues && new Set(Object.values(changes.hues)).size !== Object.keys(changes.hues).length) {
      return { error: 'INVALID', field: 'hues', message: 'Dos integrantes no pueden tener el mismo color' };
    }

    const diff = rules.diffSettings(before, changes);
    if (diff.length === 0) return { settings: toView(asset) };

    const columns = Object.fromEntries(rules.ASSET_FIELDS.filter((f) => f in changes).map((f) => [f, changes[f]]));
    if (Object.keys(columns).length > 0) await tx.asset.update({ where: { id: assetId }, data: columns });
    await saveMembers(tx, assetId, parsed.value);
    await tx.activityLog.create({ data: { assetId, userId, type: LOG_TYPE, payload: { changes: diff } } });

    const { asset: updated } = await load(tx, assetId, userId);
    return { settings: toView(updated) };
  }, TX_OPTIONS);
}

module.exports = { getSettings, updateSettings, huesOf, percentsOf, LOG_TYPE };
