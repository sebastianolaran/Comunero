// Reglas de Movimientos que no tocan la base: validacion del alta y la
// edicion, reparto por persona, "cuanto te toca", resumen del periodo, copia
// de los recurrentes y manejo de fechas. Viven aparte de Prisma para
// testearlas sin base.

const { badRequest, notFound } = require('../lib/httpError');

const MOVEMENT_TYPES = ['EXPENSE', 'INCOME'];
const MAX_DESCRIPTION_LENGTH = 100;
const MAX_DB_INT = 2147483647;
const TIME_ZONE = 'America/Argentina/Buenos_Aires';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// ---------------------------------------------------------------------------
// Fechas y periodos
// ---------------------------------------------------------------------------

function isValidDay(value) {
  if (typeof value !== 'string' || !DAY_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isValidPeriod(value) {
  return typeof value === 'string' && PERIOD_RE.test(value);
}

// Las columnas @db.Date se leen y escriben como medianoche UTC.
function toDateOnly(day) {
  return new Date(`${day}T00:00:00.000Z`);
}

function fromDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

// Primer dia del mes siguiente, como AAAA-MM-DD: '2026-07-15' -> '2026-08-01'.
function firstDayOfNextMonth(day) {
  const [year, month] = day.split('-').map(Number);
  return fromDateOnly(new Date(Date.UTC(year, month, 1)));
}

function periodRange(period) {
  const [year, month] = period.split('-').map(Number);
  return { gte: new Date(Date.UTC(year, month - 1, 1)), lt: new Date(Date.UTC(year, month, 1)) };
}

// Mes actual en hora argentina: el server de Render corre en UTC y a las
// 22 hs del ultimo dia del mes ya seria el mes siguiente.
function currentPeriod(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  const part = (type) => parts.find((p) => p.type === type).value;
  return `${part('year')}-${part('month')}`;
}

// Meses con movimientos mas el mes actual, del mas nuevo al mas viejo.
function buildPeriodList(periods, current) {
  return [...new Set([...periods, current])].sort().reverse();
}

function parseId(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') throw notFound('el movimiento no existe');
  return raw;
}

// Los ids son cuid (texto): se ordenan como texto, para que el reparto salga
// siempre en el mismo orden.
function byId(a, b) {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Validacion
// ---------------------------------------------------------------------------

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function validateDescription(value, prefix) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw badRequest(`${prefix}la descripción no puede estar vacía`);
  if (text.length > MAX_DESCRIPTION_LENGTH) {
    throw badRequest(`${prefix}la descripción no puede superar los ${MAX_DESCRIPTION_LENGTH} caracteres`);
  }
  return text;
}

function validateAmount(value, prefix) {
  if (!isPositiveInteger(value) || value > MAX_DB_INT) {
    throw badRequest(`${prefix}el monto tiene que ser un número entero mayor a cero`);
  }
  return value;
}

function validateShareIds(value, userIds, prefix) {
  if (!Array.isArray(value) || value.length === 0) {
    throw badRequest(`${prefix}el reparto tiene que incluir al menos a una persona`);
  }
  const ids = [...new Set(value)];
  if (!ids.every((id) => userIds.includes(id))) {
    throw badRequest(`${prefix}el reparto incluye a alguien que no es copropietario del bien`);
  }
  return ids.sort(byId);
}

// Valida el body de alta/edicion contra los copropietarios del bien y lo
// devuelve normalizado. Un movimiento desglosado trae `items` (dos o mas, cada
// uno con su reparto) y su monto es la suma; si no, trae `amount` y `shareIds`.
// Quien pago o cobro es obligatorio siempre, tambien en los recurrentes.
function validateMovementInput(body, userIds) {
  const input = body && typeof body === 'object' ? body : {};

  if (!MOVEMENT_TYPES.includes(input.type)) throw badRequest('el tipo tiene que ser gasto o ingreso');
  const description = validateDescription(input.description, '');
  if (!isValidDay(input.date)) {
    throw badRequest('la fecha tiene que ser un día válido con formato AAAA-MM-DD');
  }
  if (input.paidById === null || input.paidById === undefined) {
    throw badRequest('falta indicar quién pagó o cobró');
  }
  if (!userIds.includes(input.paidById)) {
    throw badRequest('quien pagó o cobró tiene que ser copropietario del bien');
  }
  const { paidById } = input;

  let amount;
  let shareIds = null;
  let items = null;
  if (Array.isArray(input.items) && input.items.length > 0) {
    if (input.items.length < 2) throw badRequest('el desglose tiene que tener al menos dos ítems');
    items = input.items.map((raw, i) => {
      const item = raw && typeof raw === 'object' ? raw : {};
      const prefix = `ítem ${i + 1}: `;
      return {
        description: validateDescription(item.description, prefix),
        amount: validateAmount(item.amount, prefix),
        shareIds: validateShareIds(item.shareIds, userIds, prefix),
      };
    });
    amount = validateAmount(items.reduce((sum, item) => sum + item.amount, 0), '');
  } else {
    amount = validateAmount(input.amount, '');
    shareIds = validateShareIds(input.shareIds, userIds, '');
  }

  const recurring = input.recurring === true;

  return { type: input.type, description, date: input.date, paidById, amount, shareIds, items, recurring };
}

// ---------------------------------------------------------------------------
// Reparto
// ---------------------------------------------------------------------------

// Partes iguales sin decimales: a cada persona le toca el monto dividido por
// la cantidad de personas, redondeado para abajo. El resto de la division
// (lo que falta para llegar al total) queda para quien pago o cobro.
function splitEvenly(amount, count) {
  const each = Math.floor(amount / count);
  return { each, remainder: amount - each * count };
}

// Si quien pago o cobro esta en el reparto, el resto se suma a su parte y el
// reparto da justo el total. Si no esta, el resto no se reparte: lo pone el
// (gasto) o se lo queda (ingreso).
function sharesFor(amount, userIds, paidById) {
  const { each, remainder } = splitEvenly(amount, userIds.length);
  return userIds.map((userId) => ({
    userId,
    amount: userId === paidById ? each + remainder : each,
  }));
}

function buildShares(input) {
  if (!input.items) return { shares: sharesFor(input.amount, input.shareIds, input.paidById), items: [] };

  const totals = new Map();
  const items = input.items.map((item, position) => {
    const shares = sharesFor(item.amount, item.shareIds, input.paidById);
    for (const share of shares) {
      totals.set(share.userId, (totals.get(share.userId) ?? 0) + share.amount);
    }
    return { position, description: item.description, amount: item.amount, shares };
  });
  const shares = [...totals]
    .sort(([a], [b]) => byId(a, b))
    .map(([userId, amount]) => ({ userId, amount }));
  return { shares, items };
}

// Cuanto le toca al usuario actual en un movimiento. Quien paga un gasto
// queda como acreedor de los demas; quien cobra un ingreso asume la deuda con
// cada uno por su parte:
//  gasto   -> pague yo: OWED_TO_YOU (lo de los demas) | incluido: YOU_OWE (mi parte)
//  ingreso -> cobre yo: YOU_OWE (lo de los demas)     | incluido: OWED_TO_YOU (mi parte)
//  pague o cobre yo y en el reparto estoy solo: NO_DEBT
//  no estoy en el reparto ni pague o cobre: NOT_INCLUDED
function computeMyPart({ type, paidById, shares }, meId) {
  if (paidById === meId) {
    const others = shares
      .filter((share) => share.userId !== meId)
      .reduce((sum, share) => sum + share.amount, 0);
    if (others === 0) return { kind: 'NO_DEBT', amount: 0 };
    return { kind: type === 'EXPENSE' ? 'OWED_TO_YOU' : 'YOU_OWE', amount: others };
  }

  const mine = shares.find((share) => share.userId === meId);
  if (!mine) return { kind: 'NOT_INCLUDED', amount: 0 };
  return { kind: type === 'EXPENSE' ? 'YOU_OWE' : 'OWED_TO_YOU', amount: mine.amount };
}

// Resumen del periodo para todo el bien: lo que entro menos lo que salio en
// ese mes, sin arrastrar los meses anteriores.
function summarizePeriod(movements) {
  let income = 0;
  let expense = 0;
  // Saldo del que mira en el período: lo que le deben menos lo que debe.
  let mine = 0;
  for (const movement of movements) {
    if (movement.type === 'INCOME') income += movement.amount;
    else expense += movement.amount;
    const { kind, amount } = movement.myPart ?? {};
    if (kind === 'OWED_TO_YOU') mine += amount;
    else if (kind === 'YOU_OWE') mine -= amount;
  }
  return { income, expense, net: income - expense, mine };
}

function countByType(movements) {
  return {
    all: movements.length,
    income: movements.filter((m) => m.type === 'INCOME').length,
    expense: movements.filter((m) => m.type === 'EXPENSE').length,
  };
}

// ---------------------------------------------------------------------------
// Recurrentes
// ---------------------------------------------------------------------------

// Copia de un movimiento recurrente para el mes siguiente al suyo: identica
// (tipo, monto, descripcion, quien pago, reparto e items, con los valores que
// tenga hoy) salvo la fecha, que es el 1 de ese mes. La copia tambien es
// recurrente, asi la cadena sigue desde ella.
function buildRecurrenceCopy(record) {
  const copyShares = (shares) => shares.map(({ userId, amount }) => ({ userId, amount }));
  return {
    input: {
      type: record.type,
      amount: record.amount,
      description: record.description,
      date: firstDayOfNextMonth(fromDateOnly(record.date)),
      paidById: record.paidById,
      recurring: true,
    },
    built: {
      shares: copyShares(record.shares),
      items: record.items.map((item, position) => ({
        position,
        description: item.description,
        amount: item.amount,
        shares: copyShares(item.shares),
      })),
    },
  };
}

// ---------------------------------------------------------------------------
// Respuesta de la API
// ---------------------------------------------------------------------------

function serializeShares(shares) {
  return shares.map((share) => ({ userId: share.userId, name: share.user.name, amount: share.amount }));
}

function serializeMovement(record, meId) {
  const shares = serializeShares(record.shares);
  return {
    id: record.id,
    type: record.type,
    amount: record.amount,
    description: record.description,
    date: fromDateOnly(record.date),
    paidBy: { id: record.paidBy.id, name: record.paidBy.name },
    recurring: record.recurring,
    shares,
    items: record.items.map((item) => ({
      id: item.id,
      description: item.description,
      amount: item.amount,
      shares: serializeShares(item.shares),
    })),
    myPart: computeMyPart({ type: record.type, paidById: record.paidById, shares }, meId),
  };
}

module.exports = {
  MOVEMENT_TYPES,
  MAX_DESCRIPTION_LENGTH,
  isValidDay,
  isValidPeriod,
  toDateOnly,
  fromDateOnly,
  firstDayOfNextMonth,
  periodRange,
  currentPeriod,
  buildPeriodList,
  parseId,
  validateMovementInput,
  splitEvenly,
  buildShares,
  computeMyPart,
  summarizePeriod,
  countByType,
  buildRecurrenceCopy,
  serializeMovement,
};
