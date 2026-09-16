const prisma = require('../prisma');

// Estado derivado de una solicitud de alquiler (no se guarda en la base).
// Un solo rechazo la cierra, aunque ya tuviera votos a favor. Se aprueba
// recien cuando votaron YES todos los copropietarios del bien.
function deriveStatus({ yesCount, coownerCount, rejectionCount }) {
  if (rejectionCount > 0) return 'REJECTED';
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
      startDate: true,
      endDate: true,
      _count: {
        select: {
          votes: { where: { value: 'YES' } },
          rejections: true,
        },
      },
    },
  });

  return requests.map((r) => {
    const yesCount = r._count.votes;
    return {
      id: r.id,
      tenantName: r.tenantName,
      startDate: toDateOnly(r.startDate),
      endDate: toDateOnly(r.endDate),
      yesCount,
      coownerCount,
      status: deriveStatus({ yesCount, coownerCount, rejectionCount: r._count.rejections }),
    };
  });
}

module.exports = { deriveStatus, listByAsset };
