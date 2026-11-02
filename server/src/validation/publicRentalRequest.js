// Formulario de la ficha pública: lo completa alguien sin cuenta.
const {
  parseName,
  parsePhone,
  parseDates,
  parseComments,
  fail,
  todayInArgentina,
  MAX_AMOUNT,
} = require('./newRentalRequest');

const MAX_EMAIL_LENGTH = 254;
const MAX_GUESTS = 100;
// Un pedido de años bloquearía el calendario si alguien lo aprueba sin mirar.
const MAX_DAYS = 60;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
// Lo manda alguien anónimo y termina, entre otros lados, en el .ics exportado:
// un \r suelto ahí podría colar líneas nuevas en el evento.
const CONTROL = /[\u0000-\u001f\u007f]/;
const CONTROL_EXCEPT_NEWLINE = /[\u0000-\u0009\u000b-\u001f\u007f]/g;

function cleanComments(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/\r\n?/g, '\n').replace(CONTROL_EXCEPT_NEWLINE, '');
}

function isFilled(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function parseEmail(value) {
  if (!isFilled(value)) return { value: null };
  const email = value.trim().toLowerCase();
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL.test(email)) return fail('email', 'El email no es válido');
  return { value: email };
}

function parseGuests(value, capacity) {
  if (value === undefined || value === null || value === '') return fail('guests', 'Falta la cantidad de personas');
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_GUESTS) {
    return fail('guests', 'La cantidad de personas tiene que ser un número entero mayor a cero');
  }
  if (capacity != null && value > capacity) {
    return fail('guests', `El lugar admite hasta ${capacity} ${capacity === 1 ? 'persona' : 'personas'}`);
  }
  return { value };
}

// Devuelve { request } o { error, field } con el primer campo inválido.
// capacity: la de la ficha (null = sin tope).
function parsePublicRequest(body = {}, { today = todayInArgentina(), capacity = null } = {}) {
  if (typeof body.name === 'string' && CONTROL.test(body.name)) {
    return fail('name', 'El nombre tiene caracteres no válidos');
  }
  const parsed = {
    name: parseName(body.name, 'name', 'nombre'),
    phone: parsePhone(body.phone),
    email: parseEmail(body.email),
    dates: parseDates(body.startDate, body.endDate, today),
    guests: parseGuests(body.guests, capacity),
    comments: parseComments(cleanComments(body.comments)),
  };
  const failed = Object.values(parsed).find((result) => result.error);
  if (failed) return failed;
  if (daysBetween(parsed.dates.value.startDate, parsed.dates.value.endDate) > MAX_DAYS) {
    return fail('endDate', `Se pueden pedir hasta ${MAX_DAYS} días seguidos`);
  }

  return {
    request: {
      renterName: parsed.name.value,
      phone: parsed.phone.value,
      email: parsed.email.value,
      ...parsed.dates.value,
      guests: parsed.guests.value,
      comments: parsed.comments.value,
    },
  };
}

// Contando el primero y el último, como en el alta manual.
function daysBetween(startDate, endDate) {
  return (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / MS_PER_DAY + 1;
}

// Precio por día × días. null si no hay precio cargado o si no entra en la columna.
function amountFor(startDate, endDate, dailyRate) {
  if (dailyRate == null) return null;
  const amount = daysBetween(startDate, endDate) * dailyRate;
  return amount <= MAX_AMOUNT ? amount : null;
}

module.exports = { parsePublicRequest, amountFor };
