// Reglas de la configuración del bien que no tocan la base: validación del
// PATCH, porcentajes efectivos y color de cada integrante, y qué cambió
// (para el registro de cambios).

const MAX_DB_INT = 2147483647;

// Topes generosos: solo frenan un número tipeado de más.
const LIMITS = {
  rentalDailyRate: MAX_DB_INT,
  maxConsecutiveDays: 365,
  responseHours: 720,
};

const NUMBER_FIELDS = Object.keys(LIMITS);
const NO_RESPONSE_ACTIONS = ['APPROVE', 'REJECT'];
// Los que viven como columnas de Asset.
const ASSET_FIELDS = [...NUMBER_FIELDS, 'noResponseAction'];

// Para que el error diga cuál campo está mal: un panel tiene varios.
const LABELS = {
  rentalDailyRate: 'El costo por día',
  maxConsecutiveDays: 'El máximo de días consecutivos',
  responseHours: 'El tiempo para responder',
};
const FIELDS = [...ASSET_FIELDS, 'percents'];

// Tonos oklch. Los primeros seis son los que el client ya calculaba por id. Los
// dos últimos van en los huecos más grandes de la rueda (a 35-40° de sus
// vecinos) para que no se confundan. El 195 es del alquiler.
const MEMBER_HUES = [250, 40, 150, 320, 80, 285, 0, 115];
const LEGACY_HUE_COUNT = 6;
const RENTAL_HUE = 195;

const fail = (field, error) => ({ field, error });
const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function parseNumber(field, value) {
  if (value === null) return { value: null };
  if (!Number.isInteger(value) || value < 1 || value > LIMITS[field]) {
    return fail(field, `${LABELS[field]} tiene que ser un número entero entre 1 y ${LIMITS[field]}`);
  }
  return { value };
}

function parseNoResponseAction(value) {
  if (!NO_RESPONSE_ACTIONS.includes(value)) {
    return fail('noResponseAction', 'Si alguien no responde a tiempo, se tiene que aprobar o rechazar');
  }
  return { value };
}

function parsePercents(value, memberIds) {
  if (value === null) return { value: null };
  if (!isPlainObject(value)) return fail('percents', 'Los porcentajes tienen un formato inválido');
  const ids = Object.keys(value);
  if (ids.some((id) => !memberIds.includes(id))) {
    return fail('percents', 'Hay un porcentaje para alguien que no es copropietario del bien');
  }
  if (memberIds.some((id) => !ids.includes(id))) {
    return fail('percents', 'Falta el porcentaje de alguno de los integrantes: tienen que estar todos');
  }
  if (ids.some((id) => !Number.isInteger(value[id]) || value[id] < 0 || value[id] > 100)) {
    return fail('percents', 'Cada porcentaje tiene que ser un número entero entre 0 y 100');
  }
  const sum = ids.reduce((total, id) => total + value[id], 0);
  if (sum !== 100) return fail('percents', `Los porcentajes tienen que sumar 100 (suman ${sum})`);
  return { value: { ...value } };
}

// { value } con solo las claves que vinieron, o { field, error } con la primera
// inválida. null en un número lo deja sin límite; en percents, partes iguales.
function parseSettingsInput(body, memberIds) {
  const input = isPlainObject(body) ? body : {};
  const present = FIELDS.filter((field) => input[field] !== undefined);
  if (present.length === 0) return fail(null, 'No hay nada para modificar');

  const value = {};
  for (const field of present) {
    let parsed;
    if (field === 'percents') parsed = parsePercents(input.percents, memberIds);
    else if (field === 'noResponseAction') parsed = parseNoResponseAction(input.noResponseAction);
    else parsed = parseNumber(field, input[field]);
    if (parsed.error) return parsed;
    value[field] = parsed.value;
  }
  return { value };
}

function hashHue(userId) {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return MEMBER_HUES[hash % LEGACY_HUE_COUNT];
}

// Color de cada integrante: el calculado por id salvo que ya lo tenga otro, en
// cuyo caso el primero libre de la paleta. Se recorre por id para que no
// dependa del orden. Con más integrantes que colores, se repite el calculado.
function resolveHues(memberIds) {
  const hues = {};
  const taken = new Set();
  for (const id of [...memberIds].sort()) {
    const preferred = hashHue(id);
    const hue = taken.has(preferred) ? (MEMBER_HUES.find((h) => !taken.has(h)) ?? preferred) : preferred;
    hues[id] = hue;
    taken.add(hue);
  }
  return hues;
}

// Mapa userId -> porcentaje, o null (partes iguales) si falta alguno o no
// suman 100: pasa cuando se suma o se va alguien después de cargarlos.
function resolvePercents(memberIds, stored) {
  if (memberIds.length === 0 || memberIds.some((id) => stored?.[id] == null)) return null;
  const sum = memberIds.reduce((total, id) => total + stored[id], 0);
  if (sum !== 100) return null;
  return Object.fromEntries(memberIds.map((id) => [id, stored[id]]));
}

function sameValue(a, b) {
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].every((key) => a[key] === b[key]);
  }
  return a === b;
}

// Lo que cambia de verdad, en el orden de FIELDS.
function diffSettings(before, changes) {
  return FIELDS.filter((field) => field in changes && !sameValue(before[field] ?? null, changes[field]))
    .map((field) => ({ field, from: before[field] ?? null, to: changes[field] }));
}

module.exports = {
  LIMITS,
  NUMBER_FIELDS,
  ASSET_FIELDS,
  parseSettingsInput,
  resolveHues,
  resolvePercents,
  diffSettings,
};
