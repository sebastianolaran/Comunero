// Ficha pública del bien. Cualquier copropietario la edita sin votar; cada
// cambio queda en ActivityLog y se ve en "Cambios recientes" de Configuración.
// TODO: el userId tiene que salir de la sesion, como en el resto de la API.

const prisma = require('../prisma');
const rules = require('./listing.rules');
const { todayInArgentina } = require('../validation/newRentalRequest');

const LOG_TYPE = 'LISTING_CHANGED';
// Los defaults de Prisma (2s / 5s) se quedan cortos si Neon esta despertando.
const TX_OPTIONS = { maxWait: 10_000, timeout: 15_000 };

const ASSET_SELECT = { id: true, name: true, rentalDailyRate: true, users: { select: { id: true } } };
const PHOTO_ORDER = [{ position: 'asc' }, { id: 'asc' }];

function photosOf(db, assetId) {
  return db.listingPhoto.findMany({ where: { assetId }, orderBy: PHOTO_ORDER, select: { id: true, position: true } });
}

function fieldsOf(listing) {
  if (!listing) return { ...rules.EMPTY };
  return Object.fromEntries(rules.FIELDS.map((field) => [field, listing[field]]));
}

async function viewFor(db, asset, listing) {
  const photos = await photosOf(db, asset.id);
  return {
    publicSlug: listing?.publicSlug ?? null,
    published: listing ? listing.published !== false : true,
    ...fieldsOf(listing),
    rentalDailyRate: asset.rentalDailyRate,
    photos: photos.map((p) => ({ id: p.id })),
  };
}

async function loadForCoowner(db, assetId, userId) {
  const asset = await db.asset.findUnique({ where: { id: assetId }, select: ASSET_SELECT });
  if (!asset) return { error: 'ASSET_NOT_FOUND' };
  if (!asset.users.some((u) => u.id === userId)) return { error: 'NOT_COOWNER' };
  const listing = await db.assetListing.findUnique({ where: { assetId } });
  return { asset, listing };
}

// Serializa los cambios del mismo bien: sin esto, dos a la vez quedarían
// registrados con el mismo "antes" o pasarían el tope de fotos.
async function lockAsset(tx, assetId) {
  await tx.$queryRaw`SELECT id FROM "Asset" WHERE id = ${assetId} FOR UPDATE`;
}

function log(tx, { assetId, userId, changes }) {
  return tx.activityLog.create({ data: { assetId, userId, type: LOG_TYPE, payload: { changes } } });
}

// El link se genera la primera vez que se guarda algo de la ficha.
function upsertListing(tx, assetId, fields) {
  return tx.assetListing.upsert({
    where: { assetId },
    create: { assetId, publicSlug: rules.newSlug(), ...fields },
    update: fields,
  });
}

// Devuelve { listing } o { error: 'ASSET_NOT_FOUND' | 'NOT_COOWNER' }.
async function getForCoowner({ assetId, userId }, db = prisma) {
  const { asset, listing, error } = await loadForCoowner(db, assetId, userId);
  if (error) return { error };
  return { listing: await viewFor(db, asset, listing) };
}

// Devuelve { listing } o { error: 'ASSET_NOT_FOUND' | 'NOT_COOWNER' } o { error: 'INVALID', field, message }.
async function save({ assetId, userId, body }, db = prisma) {
  return db.$transaction(async (tx) => {
    await lockAsset(tx, assetId);
    const { asset, listing, error } = await loadForCoowner(tx, assetId, userId);
    if (error) return { error };

    const parsed = rules.parseListingInput(body);
    if (parsed.error) return { error: 'INVALID', field: parsed.field, message: parsed.error };

    const changes = rules.diffListing(listing && fieldsOf(listing), parsed.value);
    if (changes.length === 0 && listing) return { listing: await viewFor(tx, asset, listing) };

    const updated = await upsertListing(tx, assetId, parsed.value);
    if (changes.length > 0) await log(tx, { assetId, userId, changes });
    return { listing: await viewFor(tx, asset, updated) };
  }, TX_OPTIONS);
}

// Devuelve { listing } o { error: 'ASSET_NOT_FOUND' | 'NOT_COOWNER' | 'TOO_MANY_PHOTOS' } o
// { error: 'INVALID', field, message }.
async function addPhoto({ assetId, userId, body }, db = prisma) {
  const parsed = rules.parsePhoto(body);
  return db.$transaction(async (tx) => {
    await lockAsset(tx, assetId);
    const { asset, listing, error } = await loadForCoowner(tx, assetId, userId);
    if (error) return { error };
    if (parsed.error) return { error: 'INVALID', field: parsed.field, message: parsed.error };

    const photos = await photosOf(tx, assetId);
    if (photos.length >= rules.MAX_PHOTOS) return { error: 'TOO_MANY_PHOTOS' };

    const position = photos.reduce((max, p) => Math.max(max, p.position + 1), 0);
    await tx.listingPhoto.create({ data: { assetId, position, ...parsed.value }, select: { id: true } });
    const current = listing ?? (await upsertListing(tx, assetId, {}));
    await log(tx, { assetId, userId, changes: [{ field: 'listing.photos', from: photos.length, to: photos.length + 1 }] });
    return { listing: await viewFor(tx, asset, current) };
  }, TX_OPTIONS);
}

// Devuelve { listing } o { error: 'ASSET_NOT_FOUND' | 'NOT_COOWNER' | 'PHOTO_NOT_FOUND' }.
async function removePhoto({ assetId, userId, photoId }, db = prisma) {
  return db.$transaction(async (tx) => {
    await lockAsset(tx, assetId);
    const { asset, listing, error } = await loadForCoowner(tx, assetId, userId);
    if (error) return { error };

    const photo = await tx.listingPhoto.findFirst({ where: { id: photoId, assetId }, select: { id: true } });
    if (!photo) return { error: 'PHOTO_NOT_FOUND' };

    const before = (await photosOf(tx, assetId)).length;
    await tx.listingPhoto.delete({ where: { id: photo.id } });
    await log(tx, { assetId, userId, changes: [{ field: 'listing.photos', from: before, to: before - 1 }] });
    return { listing: await viewFor(tx, asset, listing) };
  }, TX_OPTIONS);
}

// ids: todas las fotos del bien, en el orden nuevo; la primera es la portada
// (la de la vista previa en WhatsApp). Tiene que ser exactamente el mismo
// conjunto: así una lista vieja no pisa una foto subida o borrada en el medio.
// Devuelve { listing } o { error: 'ASSET_NOT_FOUND' | 'NOT_COOWNER' } o { error: 'INVALID', field, message }.
async function reorderPhotos({ assetId, userId, ids }, db = prisma) {
  return db.$transaction(async (tx) => {
    await lockAsset(tx, assetId);
    const { asset, listing, error } = await loadForCoowner(tx, assetId, userId);
    if (error) return { error };

    const current = (await photosOf(tx, assetId)).map((p) => p.id);
    const sameSet = ids.length === current.length && new Set(ids).size === ids.length && ids.every((id) => current.includes(id));
    if (!sameSet) {
      return { error: 'INVALID', field: 'ids', message: 'Las fotos cambiaron mientras tanto: recargar y volver a ordenar' };
    }
    if (ids.every((id, i) => id === current[i])) return { listing: await viewFor(tx, asset, listing) };

    for (const [position, id] of ids.entries()) {
      await tx.listingPhoto.update({ where: { id }, data: { position } });
    }
    await log(tx, { assetId, userId, changes: [{ field: 'listing.photos.order', from: null, to: null }] });
    return { listing: await viewFor(tx, asset, listing) };
  }, TX_OPTIONS);
}

// Para las miniaturas del panel: andan aunque la ficha esté pausada.
// Devuelve { photo: { mimeType, data } } o { error: 'ASSET_NOT_FOUND' | 'NOT_COOWNER' | 'PHOTO_NOT_FOUND' }.
async function getPhotoForCoowner({ assetId, userId, photoId }, db = prisma) {
  const { error } = await loadForCoowner(db, assetId, userId);
  if (error) return { error };
  const photo = await db.listingPhoto.findFirst({ where: { id: photoId, assetId }, select: { mimeType: true, data: true } });
  return photo ? { photo } : { error: 'PHOTO_NOT_FOUND' };
}

// Devuelve { listing } o { error: 'ASSET_NOT_FOUND' | 'NOT_COOWNER' }.
async function setPublished({ assetId, userId, published }, db = prisma) {
  return db.$transaction(async (tx) => {
    await lockAsset(tx, assetId);
    const { asset, listing, error } = await loadForCoowner(tx, assetId, userId);
    if (error) return { error };
    const before = listing ? listing.published !== false : true;
    if (before === published && listing) return { listing: await viewFor(tx, asset, listing) };

    const updated = await upsertListing(tx, assetId, { published });
    if (before !== published) {
      await log(tx, { assetId, userId, changes: [{ field: 'listing.published', from: before, to: published }] });
    }
    return { listing: await viewFor(tx, asset, updated) };
  }, TX_OPTIONS);
}

// El link anterior deja de andar. En el registro no van los links: alcanza con
// saber quién lo cambió y cuándo.
// Devuelve { listing } o { error: 'ASSET_NOT_FOUND' | 'NOT_COOWNER' | 'NO_LISTING' }.
async function regenerateLink({ assetId, userId }, db = prisma) {
  return db.$transaction(async (tx) => {
    await lockAsset(tx, assetId);
    const { asset, listing, error } = await loadForCoowner(tx, assetId, userId);
    if (error) return { error };
    if (!listing) return { error: 'NO_LISTING' };

    const updated = await upsertListing(tx, assetId, { publicSlug: rules.newSlug() });
    await log(tx, { assetId, userId, changes: [{ field: 'listing.link', from: null, to: null }] });
    return { listing: await viewFor(tx, asset, updated) };
  }, TX_OPTIONS);
}

// Solo fichas publicadas: una pausada se comporta como un link que no existe.
async function findBySlug(db, slug) {
  if (typeof slug !== 'string' || slug === '') return null;
  const listing = await db.assetListing.findUnique({
    where: { publicSlug: slug },
    include: { asset: { select: ASSET_SELECT } },
  });
  return listing && listing.published !== false ? listing : null;
}

// Lo que ve cualquiera con el link: nada de integrantes, ids de usuarios ni el
// código para sumarse. null si el link no existe.
async function getPublic(slug, db = prisma) {
  const listing = await findBySlug(db, slug);
  if (!listing) return null;
  const { publicSlug, published, photos, ...view } = await viewFor(db, listing.asset, listing);
  return { name: listing.asset.name, ...view, photos };
}

// { mimeType, data } o null si la foto no es del bien de ese link.
async function getPublicPhoto(slug, photoId, db = prisma) {
  const listing = await findBySlug(db, slug);
  if (!listing || typeof photoId !== 'string') return null;
  return db.listingPhoto.findFirst({
    where: { id: photoId, assetId: listing.assetId },
    select: { mimeType: true, data: true },
  });
}

// Días ocupados para la ficha: cualquier reserva aprobada (uso propio o
// alquiler), sin decir de quién ni de qué tipo. null si el link no existe.
async function getAvailability(slug, today = new Date(`${todayInArgentina()}T00:00:00.000Z`), db = prisma) {
  const listing = await findBySlug(db, slug);
  if (!listing) return null;
  const reservations = await db.reservation.findMany({
    where: {
      assetId: listing.assetId,
      status: 'ACTIVE',
      endDate: { gte: today },
      startDate: { lte: new Date(`${rules.lastBookableDay(today.toISOString().slice(0, 10))}T00:00:00.000Z`) },
    },
    select: { startDate: true, endDate: true },
  });
  return rules.mergeRanges(reservations);
}

// Para el formulario público: el bien sale del link, nunca de lo que mande el visitante.
async function assetForSlug(slug, db = prisma) {
  const listing = await findBySlug(db, slug);
  if (!listing) return null;
  return { assetId: listing.assetId, rentalDailyRate: listing.asset.rentalDailyRate, capacity: listing.capacity };
}

module.exports = {
  getForCoowner,
  save,
  addPhoto,
  removePhoto,
  getPublic,
  getPublicPhoto,
  getAvailability,
  assetForSlug,
  setPublished,
  regenerateLink,
  reorderPhotos,
  getPhotoForCoowner,
  LOG_TYPE,
};
