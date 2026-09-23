const prisma = require('../prisma');

const collator = new Intl.Collator('es', { sensitivity: 'base' });

// NFD separa la tilde de la letra, asi "Lucía" queda "lucia".
function normalize(text) {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

// El telefono se guarda solo con digitos: "11-2366" tiene que encontrar 1123669503.
function matchesWord(renter, word) {
  if (normalize(renter.name).includes(word)) return true;
  const digits = word.replace(/\D/g, '');
  return /^[\d()+.-]+$/.test(word) && digits !== '' && renter.phone.includes(digits);
}

function matchesSearch(renter, q = '') {
  const words = normalize(q).split(/\s+/).filter(Boolean);
  return words.every((word) => matchesWord(renter, word));
}

// hoy: Date UTC medianoche. Termino si su ultimo dia es anterior a hoy.
function finishedStays(hoy) {
  return { type: 'RENTAL', status: 'ACTIVE', endDate: { lt: hoy } };
}

async function listFinished(assetId, q, hoy) {
  const asset = await prisma.asset.findUnique({ where: { id: assetId }, select: { id: true } });
  if (!asset) return null;

  const finished = finishedStays(hoy);
  const renters = await prisma.renter.findMany({
    where: { assetId, reservations: { some: finished } },
    select: {
      id: true,
      name: true,
      phone: true,
      rating: true,
      _count: { select: { reservations: { where: finished } } },
    },
  });

  return renters
    .filter((r) => matchesSearch(r, q))
    .sort((a, b) => collator.compare(a.name, b.name))
    .map(({ _count, ...r }) => ({ ...r, finishedStays: _count.reservations }));
}

// En UTC, para que el client no corra el dia por su zona horaria.
function toDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

const COMMENT_SELECT = { id: true, text: true, createdAt: true, author: { select: { id: true, name: true } } };

function toComment({ id, text, createdAt, author }) {
  return { id, text, createdAt: createdAt.toISOString(), author: { id: author.id, name: author.name } };
}

// Acotado al bien: con un id de inquilino de otro bien devuelve null.
async function getDetail(renterId, assetId, hoy) {
  const renter = await prisma.renter.findFirst({
    where: { id: renterId, assetId },
    select: {
      id: true,
      name: true,
      phone: true,
      rating: true,
      reservations: {
        where: finishedStays(hoy),
        orderBy: { startDate: 'desc' },
        select: { startDate: true, endDate: true },
      },
      observations: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: COMMENT_SELECT },
    },
  });
  if (!renter) return null;

  const { id, name, phone, rating, reservations, observations } = renter;
  return {
    id,
    name,
    phone,
    rating,
    stays: reservations.map((r) => ({ startDate: toDateOnly(r.startDate), endDate: toDateOnly(r.endDate) })),
    comments: observations.map(toComment),
  };
}

// Devuelve el error si el inquilino no existe o quien escribe no es copropietario de su bien.
async function checkCoowner(renterId, userId) {
  const renter = await prisma.renter.findUnique({ where: { id: renterId }, select: { id: true, assetId: true } });
  if (!renter) return 'NOT_FOUND';
  const coowner = await prisma.user.findFirst({ where: { id: userId, assetId: renter.assetId }, select: { id: true } });
  return coowner ? null : 'NOT_COOWNER';
}

// Sin votacion: vale la ultima que se guardo. null = sin definir.
async function setRating({ renterId, userId, rating }) {
  const error = await checkCoowner(renterId, userId);
  if (error) return { error };

  const tenant = await prisma.renter.update({
    where: { id: renterId },
    data: { rating },
    select: { id: true, rating: true },
  });
  return { tenant };
}

async function addComment({ renterId, userId, text }) {
  const error = await checkCoowner(renterId, userId);
  if (error) return { error };

  const created = await prisma.renterObservation.create({
    data: { renterId, authorId: userId, text },
    select: COMMENT_SELECT,
  });
  return { comment: toComment(created) };
}

module.exports = { matchesSearch, listFinished, getDetail, setRating, addComment };
