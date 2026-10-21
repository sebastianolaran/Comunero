// Reglas de los bienes que no tocan la base (se testean sin base).

const MAX_NAME_LENGTH = 60;

// Sin 0/O ni 1/I/L, que se confunden al copiar a mano.
const LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const CHARS = `${LETTERS}23456789`;
const CONSONANTS = 'BCDFGHJKMNPQRSTVWXZ';
const CODE_RE = /^([A-Z]{3})-?([A-Z0-9]{4})$/;

const WEEK_DAYS = 7;
const RENTAL_LOOKAHEAD_DAYS = 30;

function parseName(raw) {
  const name = typeof raw === 'string' ? raw.trim() : '';
  if (!name) return { error: 'El nombre no puede quedar vacío' };
  if (name.length > MAX_NAME_LENGTH) {
    return { error: `El nombre no puede superar los ${MAX_NAME_LENGTH} caracteres` };
  }
  return { value: name };
}

function pick(alphabet, random) {
  return alphabet[Math.floor(random() * alphabet.length)];
}

// "Casa quinta" -> QNT: consonantes de la última palabra, completadas al azar.
function codePrefix(name, random) {
  const lastWord = name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter(Boolean)
    .pop() ?? '';
  let prefix = [...lastWord].filter((c) => CONSONANTS.includes(c)).slice(0, 3).join('');
  while (prefix.length < 3) prefix += pick(LETTERS, random);
  return prefix;
}

// AAA-1234. Si choca con el de otro bien, el service genera otro.
function generateInviteCode(name, random = Math.random) {
  let suffix = '';
  for (let i = 0; i < 4; i += 1) suffix += pick(CHARS, random);
  return `${codePrefix(name, random)}-${suffix}`;
}

// "qnt 7k4p" -> "QNT-7K4P"; null si no tiene forma de código.
function normalizeInviteCode(raw) {
  if (typeof raw !== 'string') return null;
  const match = CODE_RE.exec(raw.replace(/\s+/g, '').toUpperCase());
  return match ? `${match[1]}-${match[2]}` : null;
}

function toDay(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(day, days) {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toDay(date);
}

const byStart = (a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0);

// Frase de la tarjeta, en orden de prioridad: tu próxima estadía, lo que ocupa
// el bien esta semana, un alquiler de los próximos 30 días, o libre.
function stayLine(reservations, userId, today) {
  const upcoming = reservations.filter((r) => r.endDate >= today).sort(byStart);
  const range = (r) => ({ startDate: r.startDate, endDate: r.endDate });

  const mine = upcoming.find((r) => r.type === 'USE' && r.userId === userId);
  if (mine) return { kind: 'MY_STAY', ...range(mine) };

  const weekEnd = addDays(today, WEEK_DAYS - 1);
  const thisWeek = upcoming.find((r) => r.startDate <= weekEnd);
  if (thisWeek) {
    return thisWeek.type === 'RENTAL'
      ? { kind: 'RENTED', ...range(thisWeek) }
      : { kind: 'RESERVED', ...range(thisWeek), userName: thisWeek.userName };
  }

  const rentalEnd = addDays(today, RENTAL_LOOKAHEAD_DAYS - 1);
  const rental = upcoming.find((r) => r.type === 'RENTAL' && r.startDate <= rentalEnd);
  if (rental) return { kind: 'RENTED', ...range(rental) };

  return { kind: 'FREE_WEEK' };
}

// Reservas y propuestas en votación en las que userId todavía no votó.
function pendingVotes(pending, openDecisions, userId) {
  const reservations = pending.filter(
    (r) => r.userId !== userId && !r.approvals.includes(userId) && !r.objections.includes(userId),
  ).length;
  const decisions = openDecisions.filter((d) => !d.voters.includes(userId)).length;
  return reservations + decisions;
}

function toCard(asset, userId, today) {
  const active = asset.reservations.filter((r) => r.status === 'ACTIVE');
  const pending = asset.reservations.filter((r) => r.status === 'PENDING');
  return {
    id: asset.id,
    name: asset.name,
    inviteCode: asset.inviteCode,
    members: asset.users.map((u) => ({ id: u.id, name: u.name })),
    stay: stayLine(active, userId, today),
    pendingVotes: pendingVotes(pending, asset.decisions, userId),
  };
}

module.exports = {
  MAX_NAME_LENGTH,
  parseName,
  generateInviteCode,
  normalizeInviteCode,
  stayLine,
  pendingVotes,
  toCard,
  toDay,
};
