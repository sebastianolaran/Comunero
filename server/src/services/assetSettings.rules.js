// Reglas de la configuración del bien que no tocan la base: validación del
// PATCH, porcentajes y colores efectivos de cada integrante, y qué cambió
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
const FIELDS = [...ASSET_FIELDS, 'percents', 'hues'];

// Tonos oklch. Los primeros seis son los que el client ya calculaba por id, así
// nadie cambia de color hasta que elija uno. El 195 es del alquiler.
const MEMBER_HUES = [250, 40, 150, 320, 80, 285, 15, 110];
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

function parseHues(value, memberIds) {
  if (!isPlainObject(value)) return fail('hues', 'Los colores tienen un formato inválido');
  const ids = Object.keys(value);
  if (ids.some((id) => !memberIds.includes(id))) {
    return fail('hues', 'Hay un color para alguien que no es copropietario del bien');
  }
  const hues = Object.values(value);
  if (hues.some((hue) => !MEMBER_HUES.includes(hue))) return fail('hues', 'Ese color no está disponible');
  if (new Set(hues).size !== hues.length) return fail('hues', 'Dos integrantes no pueden tener el mismo color');
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
    else if (field === 'hues') parsed = parseHues(input.hues, memberIds);
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

// Color de cada integrante: el que eligió o, si no eligió, el calculado por id
// salvo que ya lo tenga otro, en cuyo caso el primero libre de la paleta. Se
// recorre por id para que no dependa del orden. Con más integrantes que
// colores, se repite el calculado.
function resolveHues(memberIds, stored) {
  const hues = {};
  const taken = new Set();
  for (const id of memberIds) {
    if (stored[id] != null) {
      hues[id] = stored[id];
      taken.add(stored[id]);
    }
  }
  for (const id of [...memberIds].sort()) {
    if (hues[id] != null) continue;
    const preferred = hashHue(id);
    const hue = taken.has(preferred) ? (MEMBER_HUES.find((h) => !taken.has(h)) ?? preferred) : preferred;
    hues[id] = hue;
    taken.add(hue);
  }
  return hues;
}

// Mapa userId -> porcentaje, o null (partes iguales) si falta alguno o no
// suman 100: pasa cuando se suma alguien al bien después de cargarlos.
function resolvePercents(memberIds, stored) {
  if (memberIds.length === 0 || memberIds.some((id) => stored[id] == null)) return null;
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
  MEMBER_HUES,
  RENTAL_HUE,
  parseSettingsInput,
  resolveHues,
  resolvePercents,
  diffSettings,
};
