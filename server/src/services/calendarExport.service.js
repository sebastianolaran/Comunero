// Exportar el calendario a .ics. Recibe una lista de bienes (hoy, el del
// calendario; más adelante, todos los de Mis bienes).
// TODO: cuando exista el login, userId tiene que salir de la sesion.

const prisma = require('../prisma');
// Modulo entero (no destructuring) para poder mockearlo en los tests.
const reservationExpiry = require('./reservationExpiry.service');
const { filtroDeAlcance } = require('./calendarExport.rules');
const { forbidden } = require('../lib/httpError');

// { assets, reservas }: las reservas aprobadas (ACTIVE) que terminan desde
// `desde` en adelante, incluidas las que están en curso. Falla con 403 si
// userId no es copropietario de alguno de los bienes.
async function listarParaExportar({ userId, assetIds, scope, desde }) {
  const assets = await prisma.asset.findMany({
    where: { id: { in: assetIds }, users: { some: { id: userId } } },
    select: { id: true, name: true },
  });
  if (assets.length !== new Set(assetIds).size) {
    throw forbidden('Solo los copropietarios del bien pueden exportar su calendario');
  }

  // Igual que al abrir el calendario: una pendiente vencida puede pasar a aprobada.
  for (const assetId of assetIds) await reservationExpiry.expireForAsset(assetId);

  // Sin teléfono, monto ni nota: lo que no se pide no puede terminar en el archivo.
  const reservas = await prisma.reservation.findMany({
    where: {
      assetId: { in: assetIds },
      status: 'ACTIVE',
      endDate: { gte: desde },
      ...filtroDeAlcance(scope, userId),
    },
    select: {
      id: true,
      type: true,
      startDate: true,
      endDate: true,
      user: { select: { name: true } },
      renter: { select: { name: true } },
      asset: { select: { name: true } },
    },
    orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
  });

  return { assets, reservas };
}

module.exports = { listarParaExportar };
