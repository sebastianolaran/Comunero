require('dotenv').config({ quiet: true });
const prisma = require('../src/prisma');

const ASSET_ID = 'seed-casa-quinta';
const PASSWORD_HASH = 'seed-sin-login';

async function limpiar() {
  const reservas = { reservation: { assetId: ASSET_ID } };
  await prisma.reservationApproval.deleteMany({ where: reservas });
  await prisma.objection.deleteMany({ where: reservas });
  await prisma.reservation.deleteMany({ where: { assetId: ASSET_ID } });
  await prisma.renter.deleteMany({ where: { assetId: ASSET_ID } });
  await prisma.user.deleteMany({ where: { assetId: ASSET_ID } });
  await prisma.asset.deleteMany({ where: { id: ASSET_ID } });
}

async function main() {
  await limpiar();

  await prisma.asset.create({ data: { id: ASSET_ID, name: 'Casa quinta' } });

  // Ids fijos para poder usarlos como VITE_DEMO_USER_ID en el client.
  const [ana, bruno, carla, flor] = await Promise.all(
    [
      { id: 'seed-ana', name: 'Ana', phone: '5491100000001' },
      { id: 'seed-bruno', name: 'Bruno', phone: '5491100000002' },
      { id: 'seed-carla', name: 'Carla', phone: '5491100000003' },
      { id: 'seed-flor', name: 'Flor', phone: '5491100000004' },
    ].map((u) =>
      prisma.user.create({ data: { ...u, assetId: ASSET_ID, passwordHash: PASSWORD_HASH } }),
    ),
  );

  const martin = await prisma.renter.create({
    data: { assetId: ASSET_ID, name: 'Martín Suárez', phone: '5491155551234' },
  });
  const lucia = await prisma.renter.create({
    data: { assetId: ASSET_ID, name: 'Lucía Gómez', phone: '5491155556789' },
  });

  await prisma.reservation.create({
    data: {
      assetId: ASSET_ID,
      userId: bruno.id,
      renterId: lucia.id,
      type: 'RENTAL',
      status: 'ACTIVE',
      startDate: new Date('2026-12-01T00:00:00.000Z'),
      endDate: new Date('2026-12-03T00:00:00.000Z'),
      createdAt: new Date('2026-09-01T12:00:00.000Z'),
      approvals: { create: [ana, bruno, carla, flor].map((u) => ({ userId: u.id })) },
    },
  });

  await prisma.reservation.create({
    data: {
      assetId: ASSET_ID,
      userId: ana.id,
      renterId: martin.id,
      type: 'RENTAL',
      startDate: new Date('2027-01-10T00:00:00.000Z'),
      endDate: new Date('2027-01-15T00:00:00.000Z'),
      createdAt: new Date('2026-09-15T12:00:00.000Z'),
      approvals: { create: [{ userId: ana.id }] },
    },
  });

  await prisma.reservation.create({
    data: {
      assetId: ASSET_ID,
      userId: carla.id,
      renterId: lucia.id,
      type: 'RENTAL',
      startDate: new Date('2026-10-10T00:00:00.000Z'),
      endDate: new Date('2026-10-12T00:00:00.000Z'),
      depositAmount: 120000,
      createdAt: new Date('2026-09-17T12:00:00.000Z'),
      approvals: { create: [ana, bruno].map((u) => ({ userId: u.id })) },
    },
  });

  console.log(`seed ok. VITE_DEMO_ASSET_ID=${ASSET_ID} VITE_DEMO_USER_ID=${flor.id}`);
}

main()
  .catch((err) => {
    console.error('seed: fallo', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
