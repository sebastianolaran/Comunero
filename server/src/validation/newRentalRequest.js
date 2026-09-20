const MAX_NAME_LENGTH = 100;
const MAX_PHONE_LENGTH = 30;
const MAX_COMMENTS_LENGTH = 500;
const MAX_ID_LENGTH = 64;
// Reservation.amount es Int: int4 en Postgres.
const MAX_AMOUNT = 2_147_483_647;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const PHONE_CHARS = /^[\d\s()+.-]+$/;

// en-CA formatea como YYYY-MM-DD.
const ARGENTINA_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });

function todayInArgentina(now = new Date()) {
  return ARGENTINA_DATE.format(now);
}

// Formato libre: se comparan solo los digitos para que "11 1122-3344" matchee "1111223344".
function normalizePhone(phone) {
  return phone.replace(/\D/g, '');
}

function isFilled(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function isId(value) {
  return isFilled(value) && value.length <= MAX_ID_LENGTH;
}

// Descarta fechas inexistentes como 2026-02-30, que Date corre al mes siguiente.
function isValidDate(value) {
  if (typeof value !== 'string' || !DATE_ONLY.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function fail(field, error) {
  return { field, error };
}

function parseName(value, field, label) {
  if (!isFilled(value)) return fail(field, `Falta el ${label}`);
  const trimmed = value.trim();
  if (trimmed.length > MAX_NAME_LENGTH) return fail(field, `El ${label} no puede superar los ${MAX_NAME_LENGTH} caracteres`);
  return { value: trimmed };
}

function parsePhone(value) {
  if (!isFilled(value)) return fail('phone', 'Falta el teléfono');
  if (value.length > MAX_PHONE_LENGTH || !PHONE_CHARS.test(value)) {
    return fail('phone', 'El teléfono solo puede tener números');
  }
  const digits = normalizePhone(value);
  if (digits === '') return fail('phone', 'Falta el teléfono');
  return { value: digits };
}

function parseAmount(value) {
  if (value === undefined || value === null || value === '') return fail('amount', 'Falta el monto');
  if (!Number.isSafeInteger(value)) return fail('amount', 'El monto tiene que ser un número entero');
  if (value < 0) return fail('amount', 'El monto no puede ser negativo');
  if (value > MAX_AMOUNT) return fail('amount', 'El monto es demasiado grande');
  return { value };
}

function parseDates(startDate, endDate, today) {
  if (!isValidDate(startDate)) return fail('startDate', 'Falta una fecha de inicio válida');
  if (!isValidDate(endDate)) return fail('endDate', 'Falta una fecha de fin válida');
  // Las fechas YYYY-MM-DD se comparan bien como texto.
  if (startDate < today) return fail('startDate', 'La fecha de inicio no puede ser anterior a hoy');
  if (startDate > endDate) return fail('endDate', 'La fecha de fin no puede ser anterior a la de inicio');
  return { value: { startDate, endDate } };
}

function parseComments(value) {
  if (!isFilled(value)) return { value: null };
  const trimmed = value.trim();
  if (trimmed.length > MAX_COMMENTS_LENGTH) {
    return fail('comments', `Los comentarios no pueden superar los ${MAX_COMMENTS_LENGTH} caracteres`);
  }
  return { value: trimmed };
}

// Devuelve { request } o { error, field } con el primer campo invalido.
function parseNewRequest(body = {}, today = todayInArgentina()) {
  const { assetId, userId, firstName, lastName, phone, startDate, endDate, amount, comments } = body;
  if (!isId(assetId)) return fail('assetId', 'Falta el bien');
  // TODO: el userId tiene que salir de la sesion cuando exista el login.
  if (!isId(userId)) return fail('userId', 'Falta el copropietario que carga la solicitud');

  const parsed = {
    firstName: parseName(firstName, 'firstName', 'nombre'),
    lastName: parseName(lastName, 'lastName', 'apellido'),
    phone: parsePhone(phone),
    dates: parseDates(startDate, endDate, today),
    amount: parseAmount(amount),
    comments: parseComments(comments),
  };
  const failed = Object.values(parsed).find((result) => result.error);
  if (failed) return failed;

  return {
    request: {
      assetId,
      userId,
      renterName: `${parsed.firstName.value} ${parsed.lastName.value}`,
      phone: parsed.phone.value,
      ...parsed.dates.value,
      amount: parsed.amount.value,
      comments: parsed.comments.value,
    },
  };
}

module.exports = { normalizePhone, parseNewRequest, todayInArgentina };
