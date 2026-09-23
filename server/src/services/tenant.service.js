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
async function listFinished(assetId, q, hoy) {
  const asset = await prisma.asset.findUnique({ where: { id: assetId }, select: { id: true } });
  if (!asset) return null;

  const finished = { type: 'RENTAL', status: 'ACTIVE', endDate: { lt: hoy } };
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

module.exports = { matchesSearch, listFinished };
