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

  const [ana, bruno, carla] = await Promise.all(
    [
      { name: 'Ana', phone: '5491100000001' },
      { name: 'Bruno', phone: '5491100000002' },
      { name: 'Carla', phone: '5491100000003' },
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
      approvals: { create: [ana, bruno, carla].map((u) => ({ userId: u.id })) },
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

  console.log(`seed ok. VITE_DEMO_ASSET_ID=${ASSET_ID}`);
}

main()
  .catch((err) => {
    console.error('seed: fallo', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
