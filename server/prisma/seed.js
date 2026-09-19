// Seed para probar el calendario en local sin cargar datos a mano.
//
// Uso (desde server/, con DATABASE_URL ya configurado y migraciones aplicadas):
//   npx prisma db seed
//
// Crea 1 Asset, 2 User, 1 Renter, y reservas en el mes actual con los 4
// estados que la HU "Consultar calendario" tiene que distinguir:
//   - reservado (USE + ACTIVE)
//   - alquilado (RENTAL + ACTIVE)
//   - rechazado (USE + REJECTED)
//   - libre     (cualquier otro dia del mes, que queda sin reserva)
//
// Al terminar imprime el assetId: copialo en
// client/src/lib/currentAsset.js (ASSET_ID) para verlo en la UI.

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Dia de HOY + offset, en UTC medianoche (mismo criterio que usa el
// backend y el frontend del calendario).
function diaUTC(offsetDias) {
  const hoy = new Date();
  const fecha = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()));
  fecha.setUTCDate(fecha.getUTCDate() + offsetDias);
  return fecha;
}

async function main() {
  const asset = await prisma.asset.create({
    data: { name: 'Casa quinta (seed)' },
  });

  const [maria, juan] = await Promise.all([
    prisma.user.create({
      data: {
        assetId: asset.id,
        name: 'Maria',
        phone: '5491100000001',
        // No es un hash real (no hay auth implementada todavia):
        // alcanza para probar el calendario, no el login.
        passwordHash: 'seed-no-es-un-hash-real',
      },
    }),
    prisma.user.create({
      data: {
        assetId: asset.id,
        name: 'Juan',
        phone: '5491100000002',
        passwordHash: 'seed-no-es-un-hash-real',
      },
    }),
  ]);

  const renter = await prisma.renter.create({
    data: { assetId: asset.id, name: 'Familia Perez', phone: '5491100000003' },
  });

  await prisma.reservation.createMany({
    data: [
      {
        // "reservado": Maria uso el bien.
        assetId: asset.id,
        userId: maria.id,
        startDate: diaUTC(2),
        endDate: diaUTC(4),
        type: 'USE',
        status: 'ACTIVE',
      },
      {
        // "alquilado": Juan alquilo a un tercero (Familia Perez).
        assetId: asset.id,
        userId: juan.id,
        renterId: renter.id,
        startDate: diaUTC(8),
        endDate: diaUTC(12),
        type: 'RENTAL',
        status: 'ACTIVE',
      },
      {
        // "rechazado": pedido de Maria que no prospero.
        assetId: asset.id,
        userId: maria.id,
        startDate: diaUTC(15),
        endDate: diaUTC(15),
        type: 'USE',
        status: 'REJECTED',
      },
    ],
  });

  console.log('Seed listo.');
  console.log('ASSET_ID:', asset.id);
  console.log('-> copialo en client/src/lib/currentAsset.js (ASSET_ID)');
  console.log('USER_ID (Maria):', maria.id);
  console.log('USER_ID (Juan):', juan.id);
  console.log('-> copia uno de los dos en client/src/lib/currentUser.js (USER_ID)');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
