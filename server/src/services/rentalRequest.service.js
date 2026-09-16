const prisma = require('../prisma');

// Estado derivado de una solicitud de alquiler (no se guarda en la base), a
// partir de los valores de sus votos ('YES' | 'NO'). Es el mismo criterio que
// requestStatus() del prototipo: un solo NO la cierra como rechazada, aunque
// ya tuviera votos a favor, y se aprueba recien cuando votaron YES todos los
// copropietarios del bien.
function deriveStatus(votes, coownerCount) {
  if (votes.includes('NO')) return 'REJECTED';
  const yesCount = votes.filter((v) => v === 'YES').length;
  if (coownerCount > 0 && yesCount >= coownerCount) return 'APPROVED';
  return 'PENDING';
}

// Los campos @db.Date llegan como Date a medianoche UTC: se devuelven como
// "YYYY-MM-DD" para que el client no los corra de dia por la zona horaria.
function toDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

// Solicitudes del bien con el conteo de votos YES contra el total de
// copropietarios. Devuelve null si el bien no existe.
async function listByAsset(assetId) {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { _count: { select: { coowners: true } } },
  });
  if (!asset) return null;

  const coownerCount = asset._count.coowners;

  const requests = await prisma.rentalRequest.findMany({
    where: { assetId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      tenantName: true,
      contact: true,
      startDate: true,
      endDate: true,
      votes: { select: { value: true } },
    },
  });

  return requests.map((r) => {
    const votes = r.votes.map((v) => v.value);
    return {
      id: r.id,
      tenantName: r.tenantName,
      contact: r.contact,
      startDate: toDateOnly(r.startDate),
      endDate: toDateOnly(r.endDate),
      yesCount: votes.filter((v) => v === 'YES').length,
      coownerCount,
      status: deriveStatus(votes, coownerCount),
    };
  });
}

module.exports = { deriveStatus, listByAsset };
