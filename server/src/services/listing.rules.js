const crypto = require('node:crypto');

const FIELDS = ['description', 'capacity', 'services', 'approxLocation', 'conditions'];
const MAX_LONG_TEXT = 2000;
const MAX_LOCATION = 120;
const MAX_CAPACITY = 100;
const MAX_SERVICES = 20;
const MAX_SERVICE_LENGTH = 60;

const MAX_PHOTOS = 6;
// El navegador las achica a ~200 KB; el margen cubre fotos con mucho detalle.
const MAX_PHOTO_BYTES = 300 * 1024;
// Se chequean los primeros bytes: el mimeType que manda el client no alcanza
// para servirla después como imagen.
const SIGNATURES = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
};
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

const EMPTY = { description: null, capacity: null, services: [], approxLocation: null, conditions: null };

function fail(field, error) {
  return { field, error };
}

function parseText(value, field, max, label) {
  if (value === undefined || value === null) return { value: null };
  if (typeof value !== 'string') return fail(field, `${label} tiene que ser texto`);
  const trimmed = value.trim();
  if (trimmed.length > max) return fail(field, `${label} no puede superar los ${max} caracteres`);
  return { value: trimmed === '' ? null : trimmed };
}

function parseCapacity(value) {
  if (value === undefined || value === null) return { value: null };
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_CAPACITY) {
    return fail('capacity', `La capacidad tiene que ser un número entero entre 1 y ${MAX_CAPACITY}`);
  }
  return { value };
}

// Sin repetidos sin importar mayúsculas: "Wifi" y "wifi" son el mismo servicio.
function parseServices(value) {
  if (value === undefined || value === null) return { value: [] };
  if (!Array.isArray(value)) return fail('services', 'Los servicios tienen que ser una lista');
  const seen = new Set();
  const services = [];
  for (const item of value) {
    if (typeof item !== 'string') return fail('services', 'Cada servicio tiene que ser texto');
    const trimmed = item.trim();
    if (trimmed.length > MAX_SERVICE_LENGTH) {
      return fail('services', `Cada servicio puede tener hasta ${MAX_SERVICE_LENGTH} caracteres`);
    }
    const key = trimmed.toLowerCase();
    if (trimmed === '' || seen.has(key)) continue;
    seen.add(key);
    services.push(trimmed);
  }
  if (services.length > MAX_SERVICES) return fail('services', `Se pueden cargar hasta ${MAX_SERVICES} servicios`);
  return { value: services };
}

// Devuelve { value } con la ficha completa o { field, error } con el primer campo inválido.
function parseListingInput(body = {}) {
  const parsed = {
    description: parseText(body.description, 'description', MAX_LONG_TEXT, 'La descripción'),
    capacity: parseCapacity(body.capacity),
    services: parseServices(body.services),
    approxLocation: parseText(body.approxLocation, 'approxLocation', MAX_LOCATION, 'La ubicación'),
    conditions: parseText(body.conditions, 'conditions', MAX_LONG_TEXT, 'Las condiciones'),
  };
  const failed = Object.values(parsed).find((result) => result.error);
  if (failed) return failed;
  return { value: Object.fromEntries(FIELDS.map((field) => [field, parsed[field].value])) };
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Mismo formato que los cambios de Configuración, para que se lean en "Cambios recientes".
function diffListing(before, after) {
  const from = before ?? EMPTY;
  return FIELDS.filter((field) => !same(from[field], after[field])).map((field) => ({
    field: `listing.${field}`,
    from: from[field],
    to: after[field],
  }));
}

// 16 bytes aleatorios: no se puede llegar a la ficha de otro bien probando links.
function newSlug() {
  return crypto.randomBytes(16).toString('base64url');
}

function parsePhoto(body = {}) {
  const { mimeType, data } = body;
  if (!Object.hasOwn(SIGNATURES, mimeType)) return fail('mimeType', 'La foto tiene que ser JPG, PNG o WebP');
  if (typeof data !== 'string' || data === '') return fail('data', 'Falta la foto');
  if (data.length > Math.ceil(MAX_PHOTO_BYTES / 3) * 4 + 4) return fail('data', 'La foto es demasiado pesada');
  if (!BASE64.test(data)) return fail('data', 'La foto no tiene un formato válido');
  const bytes = Buffer.from(data, 'base64');
  if (bytes.length > MAX_PHOTO_BYTES) return fail('data', 'La foto es demasiado pesada');
  if (!SIGNATURES[mimeType](bytes)) return fail('data', 'El archivo no es una imagen válida');
  return { value: { mimeType, data: bytes } };
}

module.exports = {
  FIELDS,
  EMPTY,
  MAX_PHOTOS,
  MAX_PHOTO_BYTES,
  parseListingInput,
  diffListing,
  newSlug,
  parsePhoto,
};
