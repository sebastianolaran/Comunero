require('dotenv').config({ quiet: true });
const prisma = require('../src/prisma');

const ASSET_ID = 'seed-casa-quinta';
const PASSWORD_HASH = 'seed-sin-login';

async function limpiar() {
  const reservas = { reservation: { assetId: ASSET_ID } };
  await prisma.reservationApproval.deleteMany({ where: reservas });
  await prisma.objection.deleteMany({ where: reservas });
  await prisma.rentalTask.deleteMany({ where: reservas });
  await prisma.reservation.deleteMany({ where: { assetId: ASSET_ID } });
  await prisma.renter.deleteMany({ where: { assetId: ASSET_ID } });
  await prisma.vote.deleteMany({ where: { decision: { assetId: ASSET_ID } } });
  await prisma.decision.deleteMany({ where: { assetId: ASSET_ID } });
  await prisma.user.deleteMany({ where: { assetId: ASSET_ID } });
  await prisma.asset.deleteMany({ where: { id: ASSET_ID } });
}

// Las tareas se cargan "en orden": createdAt explicito y creciente, asi el orden
// de carga no depende del reloj de quien corre el seed.
// Cada tarea: [nombre, responsable, hecha?].
const BASE_CARGA = Date.parse('2026-08-01T12:00:00.000Z');
const tareas = (lista) =>
  lista.map(([name, responsable, hecha = false], i) => ({
    name,
    assignedToId: responsable.id,
    completed: hecha,
    createdAt: new Date(BASE_CARGA + i * 60_000),
    completedAt: hecha ? new Date(BASE_CARGA + i * 60_000) : null,
  }));

async function main() {
  await limpiar();

  await prisma.asset.create({ data: { id: ASSET_ID, name: 'Casa quinta', votesNeeded: 3 } });

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
  const todos = [ana, bruno, carla, flor];
  const aprobadaPor = (usuarios) => ({ create: usuarios.map((u) => ({ userId: u.id })) });

  const [gomez, alvarez, perez, rossi, sosa, torres] = await Promise.all(
    [
      { name: 'Familia Gómez', phone: '5491155550001' },
      { name: 'Familia Álvarez', phone: '5491155550002' },
      { name: 'Familia Pérez', phone: '5491155550003' },
      { name: 'Familia Rossi', phone: '5491155550004' },
      { name: 'Familia Sosa', phone: '5491155550005' },
      { name: 'Familia Torres', phone: '5491155550006' },
    ].map((r) => prisma.renter.create({ data: { ...r, assetId: ASSET_ID } })),
  );

  const martin = await prisma.renter.create({
    data: { assetId: ASSET_ID, name: 'Martín Suárez', phone: '1111223344' },
  });
  const lucia = await prisma.renter.create({
    data: { assetId: ASSET_ID, name: 'Lucía Gómez', phone: '5491155556789' },
  });

  // Solicitudes de alquiler (pestaña Solicitudes: aprobada, en votación con
  // monto y objeciones):

  await prisma.reservation.create({
    data: {
      assetId: ASSET_ID,
      userId: bruno.id,
      renterId: lucia.id,
      type: 'RENTAL',
      status: 'ACTIVE',
      note: 'Cumpleaños familiar, 8 personas.',
      amount: 180000,
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
      note: 'Somos 6 adultos. Llevamos un perro chico.',
      amount: 240000,
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
      note: 'Fin de semana largo, 5 personas, sin mascotas.',
      startDate: new Date('2026-10-10T00:00:00.000Z'),
      endDate: new Date('2026-10-12T00:00:00.000Z'),
      amount: 120000,
      createdAt: new Date('2026-09-17T12:00:00.000Z'),
      approvals: { create: [ana, bruno].map((u) => ({ userId: u.id })) },
    },
  });

  // Turnos de uso propio (pestaña Calendario). Cubren los tres estados que
  // pinta la grilla: reservado (USE vigente, con el color del integrante),
  // rechazado, y los dias sin reserva quedan libres.

  await prisma.reservation.create({
    data: {
      assetId: ASSET_ID,
      userId: ana.id,
      type: 'USE',
      status: 'ACTIVE',
      note: 'Fin de semana con los chicos.',
      startDate: new Date('2026-09-12T00:00:00.000Z'),
      endDate: new Date('2026-09-14T00:00:00.000Z'),
      approvals: aprobadaPor(todos),
    },
  });

  // Pendiente de votacion: se pinta igual que una vigente (el dia ya esta
  // pedido, no esta libre).
  await prisma.reservation.create({
    data: {
      assetId: ASSET_ID,
      userId: bruno.id,
      type: 'USE',
      note: 'Me quedo a arreglar el molino.',
      startDate: new Date('2026-09-22T00:00:00.000Z'),
      endDate: new Date('2026-09-23T00:00:00.000Z'),
      approvals: aprobadaPor([bruno]),
    },
  });

  await prisma.reservation.create({
    data: {
      assetId: ASSET_ID,
      userId: carla.id,
      type: 'USE',
      status: 'ACTIVE',
      startDate: new Date('2026-09-26T00:00:00.000Z'),
      endDate: new Date('2026-09-28T00:00:00.000Z'),
      approvals: aprobadaPor(todos),
    },
  });

  await prisma.reservation.create({
    data: {
      assetId: ASSET_ID,
      userId: flor.id,
      type: 'USE',
      status: 'REJECTED',
      startDate: new Date('2026-09-18T00:00:00.000Z'),
      endDate: new Date('2026-09-18T00:00:00.000Z'),
      approvals: aprobadaPor([flor]),
      objections: { create: [{ userId: carla.id, reason: 'Ese dia viene el plomero.' }] },
    },
  });

  // En octubre, para que el mes siguiente tampoco quede vacio.
  await prisma.reservation.create({
    data: {
      assetId: ASSET_ID,
      userId: ana.id,
      type: 'USE',
      status: 'ACTIVE',
      startDate: new Date('2026-10-24T00:00:00.000Z'),
      endDate: new Date('2026-10-26T00:00:00.000Z'),
      approvals: aprobadaPor(todos),
    },
  });

  // Tareas de preparación. Alquileres aprobados (status ACTIVE, sí de los 4):

  // Ya pasó y es del mismo inquilino que el de septiembre: dos tarjetas. "Todo listo (2/2)".
  await prisma.reservation.create({
    data: {
      assetId: ASSET_ID,
      userId: bruno.id,
      renterId: alvarez.id,
      type: 'RENTAL',
      status: 'ACTIVE',
      startDate: new Date('2026-07-10T00:00:00.000Z'),
      endDate: new Date('2026-07-12T00:00:00.000Z'),
      approvals: aprobadaPor(todos),
      tasks: {
        create: tareas([
          ['Limpieza profunda de la casa', carla, true],
          ['Revisar pileta y clorar', flor, true],
        ]),
      },
    },
  });

  // Un solo día, su única tarea hecha: "Todo listo (1/1)".
  await prisma.reservation.create({
    data: {
      assetId: ASSET_ID,
      userId: bruno.id,
      renterId: gomez.id,
      type: 'RENTAL',
      status: 'ACTIVE',
      startDate: new Date('2026-08-20T00:00:00.000Z'),
      endDate: new Date('2026-08-20T00:00:00.000Z'),
      approvals: aprobadaPor(todos),
      tasks: { create: tareas([['Limpieza previa y revisión de llaves', ana, true]]) },
    },
  });

  // Rango, una hecha y tres pendientes: "3 pendientes de 4".
  await prisma.reservation.create({
    data: {
      assetId: ASSET_ID,
      userId: carla.id,
      renterId: alvarez.id,
      type: 'RENTAL',
      status: 'ACTIVE',
      startDate: new Date('2026-09-04T00:00:00.000Z'),
      endDate: new Date('2026-09-06T00:00:00.000Z'),
      approvals: aprobadaPor(todos),
      tasks: {
        create: tareas([
          ['Limpieza profunda de la casa', carla, true],
          ['Revisar pileta y clorar', flor],
          ['Cambiar sábanas y toallas', ana],
          ['Reponer gas y carbón', bruno],
        ]),
      },
    },
  });

  // Sin tareas cargadas: "Sin tareas asignadas".
  await prisma.reservation.create({
    data: {
      assetId: ASSET_ID,
      userId: flor.id,
      renterId: sosa.id,
      type: 'RENTAL',
      status: 'ACTIVE',
      startDate: new Date('2026-11-14T00:00:00.000Z'),
      endDate: new Date('2026-11-14T00:00:00.000Z'),
      approvals: aprobadaPor(todos),
    },
  });

  // Diez tareas pendientes, todas de Ana: se muestran sin tope.
  await prisma.reservation.create({
    data: {
      assetId: ASSET_ID,
      userId: ana.id,
      renterId: torres.id,
      type: 'RENTAL',
      status: 'ACTIVE',
      startDate: new Date('2026-12-20T00:00:00.000Z'),
      endDate: new Date('2026-12-22T00:00:00.000Z'),
      approvals: aprobadaPor(todos),
      tasks: {
        create: tareas(
          [
            'Limpieza profunda de la casa',
            'Revisar pileta y clorar',
            'Cambiar sábanas y toallas',
            'Reponer gas y carbón',
            'Cortar el pasto',
            'Vaciar y limpiar la heladera',
            'Revisar el techo y las canaletas',
            'Limpiar la parrilla',
            'Sacar la basura y los reciclables',
            'Chequear luces y llaves de paso',
          ].map((nombre) => [nombre, ana]),
        ),
      },
    },
  });

  // Con tareas cargadas pero que NO deben aparecer en Tareas de preparación:

  // Le falta el voto de Flor.
  await prisma.reservation.create({
    data: {
      assetId: ASSET_ID,
      userId: ana.id,
      renterId: perez.id,
      type: 'RENTAL',
      startDate: new Date('2026-10-10T00:00:00.000Z'),
      endDate: new Date('2026-10-11T00:00:00.000Z'),
      approvals: aprobadaPor([ana, bruno, carla]),
      tasks: {
        create: tareas([
          ['Limpieza previa', carla],
          ['Revisar pileta y clorar', flor],
        ]),
      },
    },
  });

  // Rechazada por Flor.
  await prisma.reservation.create({
    data: {
      assetId: ASSET_ID,
      userId: bruno.id,
      renterId: rossi.id,
      type: 'RENTAL',
      status: 'REJECTED',
      startDate: new Date('2026-12-05T00:00:00.000Z'),
      endDate: new Date('2026-12-06T00:00:00.000Z'),
      approvals: aprobadaPor([ana, bruno, carla]),
      objections: { create: [{ userId: flor.id, reason: 'Esa fecha nos queda mal a los que vamos.' }] },
      tasks: { create: tareas([['Limpieza previa', ana]]) },
    },
  });

  // Historial de decisiones: cerradas con 3 votos necesarios. Aprobarlas no
  // genera movimientos, el monto es solo de referencia.
  const votos = (si, no = []) => ({
    create: [
      ...si.map((u) => ({ userId: u.id, value: 'YES' })),
      ...no.map((u) => ({ userId: u.id, value: 'NO' })),
    ],
  });
  const decisiones = [
    {
      title: 'Comprar un asador nuevo',
      description: 'El actual está oxidado y pierde calor.',
      proposedById: ana.id,
      status: 'APPROVED',
      closedAt: new Date('2026-09-20T15:00:00.000Z'),
      estimatedType: 'EXPENSE',
      estimatedAmount: 60000,
      votes: votos([ana, bruno, carla]),
    },
    {
      title: 'Instalar cámaras de seguridad',
      description: 'Dos cámaras en la entrada y el fondo.',
      proposedById: bruno.id,
      status: 'REJECTED',
      closedAt: new Date('2026-09-12T15:00:00.000Z'),
      estimatedType: 'EXPENSE',
      estimatedAmount: 80000,
      votes: votos([bruno], [ana, carla, flor]),
    },
    {
      title: 'Prestarle la quinta a la colonia de vacaciones',
      description: 'Pagan por usar la pileta los martes de enero.',
      proposedById: carla.id,
      status: 'APPROVED',
      closedAt: new Date('2026-09-05T15:00:00.000Z'),
      estimatedType: 'INCOME',
      estimatedAmount: 120000,
      votes: votos([ana, carla, flor], [bruno]),
    },
    {
      title: 'Poner un horario de silencio a la noche',
      description: 'Desde las 23 h los días de semana.',
      proposedById: flor.id,
      status: 'APPROVED',
      closedAt: new Date('2026-08-28T15:00:00.000Z'),
      votes: votos([ana, bruno, carla]),
    },
  ];
  for (const d of decisiones) {
    await prisma.decision.create({ data: { ...d, assetId: ASSET_ID, votesNeededAtClose: 3 } });
  }

  console.log(`seed ok. VITE_DEMO_ASSET_ID=${ASSET_ID} VITE_DEMO_USER_ID=${flor.id}`);
}

main()
  .catch((err) => {
    console.error('seed: fallo', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
