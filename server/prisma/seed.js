// Datos de prueba para desarrollo local: `npm run seed`.
// Cubre los casos del listado de solicitudes de alquiler. Usa ids fijos y
// borra antes lo que sembro la vez anterior, asi que se puede correr varias
// veces sin duplicar nada. NO correrlo contra la base de produccion.
//
// Despues de correrlo, en client/.env: VITE_DEMO_ASSET_ID=quinta-demo
// (o depto-demo para ver el aviso de lista vacia).

require('dotenv').config({ quiet: true });

const prisma = require('../src/prisma');

// Placeholder: el hasheo real de contraseñas llega con la historia de login.
const PASSWORD_HASH = 'seed-sin-hash';

const assets = [
  { id: 'quinta-demo', name: 'Quinta de los Olarán' },
  // Bien sin solicitudes: muestra el aviso de lista vacia.
  { id: 'depto-demo', name: 'Departamento en Mar del Plata' },
];

const coowners = [
  { id: 'ana-demo', assetId: 'quinta-demo', name: 'Ana', phone: '+5491100000001', email: 'ana@demo.com', color: '#e11d48', sharePct: 40 },
  { id: 'bruno-demo', assetId: 'quinta-demo', name: 'Bruno', phone: '+5491100000002', email: 'bruno@demo.com', color: '#2563eb', sharePct: 30 },
  { id: 'caro-demo', assetId: 'quinta-demo', name: 'Caro', phone: '+5491100000003', email: 'caro@demo.com', color: '#16a34a', sharePct: 30 },
  { id: 'dani-demo', assetId: 'depto-demo', name: 'Dani', phone: '+5491100000004', email: 'dani@demo.com', color: '#9333ea', sharePct: 100 },
];

// createdAt fijo para que el orden del listado sea estable (mas nueva primero).
const rentalRequests = [
  {
    // Pendiente, 1 de 3 votos a favor.
    id: 'martin-demo',
    tenantName: 'Martín Suárez',
    contact: '+5491155551234',
    startDate: '2027-01-10',
    endDate: '2027-01-15',
    comments: 'Somos una familia de cuatro, sin mascotas.',
    createdAt: '2026-09-15T12:00:00Z',
    yes: ['ana-demo'],
  },
  {
    // Pendiente, 2 de 3 votos a favor.
    id: 'marcos-demo',
    tenantName: 'Marcos Díaz',
    contact: 'marcos@mail.com',
    startDate: '2027-02-20',
    endDate: '2027-02-23',
    comments: null,
    createdAt: '2026-09-12T12:00:00Z',
    yes: ['ana-demo', 'bruno-demo'],
  },
  {
    // Rechazada aunque ya tenia votos a favor antes.
    id: 'nico-demo',
    tenantName: 'Nico Pérez',
    contact: '+5491155554321',
    startDate: '2027-02-05',
    endDate: '2027-02-08',
    comments: 'Cumpleaños con amigos.',
    createdAt: '2026-09-01T12:00:00Z',
    yes: ['ana-demo', 'bruno-demo'],
    rejection: { coownerId: 'caro-demo', reason: 'Ya alquiló antes y dejó todo sucio.' },
  },
  {
    // Aprobada: votaron a favor los 3 copropietarios.
    id: 'laura-demo',
    tenantName: 'Laura Gómez',
    contact: 'laura@mail.com',
    startDate: '2026-07-01',
    endDate: '2026-07-05',
    comments: null,
    createdAt: '2026-06-01T12:00:00Z',
    yes: ['ana-demo', 'bruno-demo', 'caro-demo'],
  },
];

// Todas las filas se arman antes de abrir la transaccion para insertar cada
// tabla con un solo createMany: contra Neon cada query es un viaje de red.
function buildRows() {
  const requests = [];
  const votes = [];
  const rejections = [];

  for (const { yes, rejection, startDate, endDate, createdAt, ...request } of rentalRequests) {
    requests.push({
      ...request,
      assetId: 'quinta-demo',
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      createdAt: new Date(createdAt),
    });

    for (const coownerId of yes) {
      votes.push({ rentalRequestId: request.id, coownerId, value: 'YES' });
    }
    if (rejection) {
      votes.push({ rentalRequestId: request.id, coownerId: rejection.coownerId, value: 'NO' });
      rejections.push({ rentalRequestId: request.id, ...rejection });
    }
  }

  return { requests, votes, rejections };
}

async function main() {
  const assetIds = assets.map((a) => a.id);
  const { requests, votes, rejections } = buildRows();

  await prisma.$transaction(async (tx) => {
    // Limpieza de la corrida anterior, de hijos a padres por las foreign keys.
    const requestFilter = { rentalRequest: { assetId: { in: assetIds } } };
    await tx.rentalRejection.deleteMany({ where: requestFilter });
    await tx.rentalVote.deleteMany({ where: requestFilter });
    await tx.rentalRequest.deleteMany({ where: { assetId: { in: assetIds } } });
    await tx.coowner.deleteMany({ where: { assetId: { in: assetIds } } });
    await tx.asset.deleteMany({ where: { id: { in: assetIds } } });

    await tx.asset.createMany({ data: assets });
    await tx.coowner.createMany({
      data: coowners.map((c) => ({ ...c, passwordHash: PASSWORD_HASH })),
    });

    await tx.rentalRequest.createMany({ data: requests });
    await tx.rentalVote.createMany({ data: votes });
    await tx.rentalRejection.createMany({ data: rejections });
  }, {
    // El default de Prisma (5 s) no alcanza contra Neon: la latencia de red y
    // el cold start de la base cortan la transaccion (error P2028).
    maxWait: 30_000,
    timeout: 60_000,
  });

  console.log(
    `seed ok: ${assets.length} bienes, ${coowners.length} copropietarios, ${rentalRequests.length} solicitudes`,
  );
}

main()
  .catch((err) => {
    console.error('seed: fallo la carga de datos de prueba', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
