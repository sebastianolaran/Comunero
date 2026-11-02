// Ficha pública del bien. Cualquier copropietario la edita sin votar; cada
// cambio queda en ActivityLog y se ve en "Cambios recientes" de Configuración.
// TODO: el userId tiene que salir de la sesion, como en el resto de la API.

const prisma = require('../prisma');
const rules = require('./listing.rules');

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

function findBySlug(db, slug) {
  if (typeof slug !== 'string' || slug === '') return null;
  return db.assetListing.findUnique({ where: { publicSlug: slug }, include: { asset: { select: ASSET_SELECT } } });
}

// Lo que ve cualquiera con el link: nada de integrantes, ids de usuarios ni el
// código para sumarse. null si el link no existe.
async function getPublic(slug, db = prisma) {
  const listing = await findBySlug(db, slug);
  if (!listing) return null;
  const { publicSlug, photos, ...view } = await viewFor(db, listing.asset, listing);
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
  assetForSlug,
  LOG_TYPE,
};
