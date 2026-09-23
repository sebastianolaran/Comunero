require('dotenv').config({ quiet: true });
const prisma = require('../src/prisma');
const { hashPassword } = require('../src/lib/password');

// Dos bienes, cada uno con sus propios copropietarios: entrando con un mail o
// con otro la app tiene que mostrar el bien que corresponde, y nunca los datos
// del otro grupo.
const CASA_ID = 'seed-casa-quinta';
const COSTA_ID = 'seed-depto-costa';
const ASSET_IDS = [CASA_ID, COSTA_ID];

// Todos los usuarios del seed entran con la misma contrasena; lo que cambia
// de uno a otro es el mail.
const PASSWORD_DEMO = 'comunero';

async function limpiar() {
  const deLosBienes = { assetId: { in: ASSET_IDS } };
  const reservas = { reservation: deLosBienes };
  await prisma.reservationApproval.deleteMany({ where: reservas });
  await prisma.objection.deleteMany({ where: reservas });
  await prisma.rentalTask.deleteMany({ where: reservas });
  await prisma.reservation.deleteMany({ where: deLosBienes });
  await prisma.renter.deleteMany({ where: deLosBienes });
  await prisma.user.deleteMany({ where: deLosBienes });
  await prisma.asset.deleteMany({ where: { id: { in: ASSET_IDS } } });
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

const aprobadaPor = (usuarios) => ({ create: usuarios.map((u) => ({ userId: u.id })) });

// Un hash por usuario y no uno compartido: con el mismo salt para todos, dos
// hashes iguales cantarian que la contrasena tambien lo es.
async function crearUsuarios(assetId, lista) {
  return Promise.all(
    lista.map(async (u) =>
      prisma.user.create({
        data: { ...u, assetId, passwordHash: await hashPassword(PASSWORD_DEMO) },
      }),
    ),
  );
}

async function sembrarCasaQuinta() {
  await prisma.asset.create({ data: { id: CASA_ID, name: 'Casa quinta' } });

  // Ids fijos: quedaron referenciados en notas y capturas del TP.
  const [ana, bruno, carla, flor] = await crearUsuarios(CASA_ID, [
    { id: 'seed-ana', name: 'Ana', email: 'ana@comunero.test', phone: '5491100000001' },
    { id: 'seed-bruno', name: 'Bruno', email: 'bruno@comunero.test', phone: '5491100000002' },
    { id: 'seed-carla', name: 'Carla', email: 'carla@comunero.test', phone: '5491100000003' },
    { id: 'seed-flor', name: 'Flor', email: 'flor@comunero.test', phone: '5491100000004' },
  ]);
  const todos = [ana, bruno, carla, flor];

  const [gomez, alvarez, perez, rossi, sosa, torres] = await Promise.all(
    [
      { name: 'Familia Gómez', phone: '5491155550001' },
      { name: 'Familia Álvarez', phone: '5491155550002' },
      { name: 'Familia Pérez', phone: '5491155550003' },
      { name: 'Familia Rossi', phone: '5491155550004' },
      { name: 'Familia Sosa', phone: '5491155550005' },
      { name: 'Familia Torres', phone: '5491155550006' },
    ].map((r) => prisma.renter.create({ data: { ...r, assetId: CASA_ID } })),
  );

  const martin = await prisma.renter.create({
    data: { assetId: CASA_ID, name: 'Martín Suárez', phone: '1111223344' },
  });
  const lucia = await prisma.renter.create({
    data: { assetId: CASA_ID, name: 'Lucía Gómez', phone: '5491155556789' },
  });

  // Solicitudes de alquiler (pestaña Solicitudes: aprobada, en votación con
  // monto y objeciones):

  await prisma.reservation.create({
    data: {
      assetId: CASA_ID,
      userId: bruno.id,
      renterId: lucia.id,
      type: 'RENTAL',
      status: 'ACTIVE',
      note: 'Cumpleaños familiar, 8 personas.',
      amount: 180000,
      startDate: new Date('2026-12-01T00:00:00.000Z'),
      endDate: new Date('2026-12-03T00:00:00.000Z'),
      createdAt: new Date('2026-09-01T12:00:00.000Z'),
      approvals: aprobadaPor(todos),
    },
  });

  await prisma.reservation.create({
    data: {
      assetId: CASA_ID,
      userId: ana.id,
      renterId: martin.id,
      type: 'RENTAL',
      note: 'Somos 6 adultos. Llevamos un perro chico.',
      amount: 240000,
      startDate: new Date('2027-01-10T00:00:00.000Z'),
      endDate: new Date('2027-01-15T00:00:00.000Z'),
      createdAt: new Date('2026-09-15T12:00:00.000Z'),
      approvals: aprobadaPor([ana]),
    },
  });

  await prisma.reservation.create({
    data: {
      assetId: CASA_ID,
      userId: carla.id,
      renterId: lucia.id,
      type: 'RENTAL',
      note: 'Fin de semana largo, 5 personas, sin mascotas.',
      startDate: new Date('2026-10-10T00:00:00.000Z'),
      endDate: new Date('2026-10-12T00:00:00.000Z'),
      amount: 120000,
      createdAt: new Date('2026-09-17T12:00:00.000Z'),
      approvals: aprobadaPor([ana, bruno]),
    },
  });

  // Turnos de uso propio (pestaña Calendario). Cubren los tres estados que
  // pinta la grilla: reservado (USE vigente, con el color del integrante),
  // rechazado, y los dias sin reserva quedan libres.

  await prisma.reservation.create({
    data: {
      assetId: CASA_ID,
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
      assetId: CASA_ID,
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
      assetId: CASA_ID,
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
      assetId: CASA_ID,
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
      assetId: CASA_ID,
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
      assetId: CASA_ID,
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
      assetId: CASA_ID,
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
      assetId: CASA_ID,
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
      assetId: CASA_ID,
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
      assetId: CASA_ID,
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
      assetId: CASA_ID,
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
      assetId: CASA_ID,
      userId: bruno.id,
      renterId: rossi.id,
      type: 'RENTAL',
      status: 'REJECTED',
      startDate: new Date('2026-12-05T00:00:00.000Z'),
      endDate: new Date('2026-12-06T00:00:00.000Z'),
      approvals: aprobadaPor([ana, bruno, carla]),
      objections: {
        create: [{ userId: flor.id, reason: 'Esa fecha nos queda mal a los que vamos.' }],
      },
      tasks: { create: tareas([['Limpieza previa', ana]]) },
    },
  });

  return [ana, bruno, carla, flor];
}

// Segundo bien, mas chico y con otro grupo: sirve para comprobar que la app
// muestra el bien del usuario que entro. Son tres copropietarios, asi la
// votacion se ve distinta a la de la casa quinta (dos de tres, no tres de
// cuatro).
async function sembrarDeptoCosta() {
  await prisma.asset.create({ data: { id: COSTA_ID, name: 'Depto en la costa' } });

  const [diego, eva, nico] = await crearUsuarios(COSTA_ID, [
    { id: 'seed-diego', name: 'Diego', email: 'diego@comunero.test', phone: '5492230000001' },
    { id: 'seed-eva', name: 'Eva', email: 'eva@comunero.test', phone: '5492230000002' },
    { id: 'seed-nico', name: 'Nico', email: 'nico@comunero.test', phone: '5492230000003' },
  ]);
  const todos = [diego, eva, nico];

  const [ruiz, mochileros] = await Promise.all(
    [
      { name: 'Familia Ruiz', phone: '5492235550001' },
      { name: 'Grupo Mochileros', phone: '5492235550002' },
    ].map((r) => prisma.renter.create({ data: { ...r, assetId: COSTA_ID } })),
  );

  // Uso propio: uno confirmado, uno esperando votos y uno el mes que viene.
  await prisma.reservation.create({
    data: {
      assetId: COSTA_ID,
      userId: diego.id,
      type: 'USE',
      status: 'ACTIVE',
      note: 'Puente de septiembre.',
      startDate: new Date('2026-09-05T00:00:00.000Z'),
      endDate: new Date('2026-09-07T00:00:00.000Z'),
      approvals: aprobadaPor(todos),
    },
  });

  await prisma.reservation.create({
    data: {
      assetId: COSTA_ID,
      userId: eva.id,
      type: 'USE',
      note: 'Llevo a mis viejos unos días.',
      startDate: new Date('2026-09-19T00:00:00.000Z'),
      endDate: new Date('2026-09-21T00:00:00.000Z'),
      approvals: aprobadaPor([eva]),
    },
  });

  await prisma.reservation.create({
    data: {
      assetId: COSTA_ID,
      userId: nico.id,
      type: 'USE',
      status: 'ACTIVE',
      startDate: new Date('2026-10-03T00:00:00.000Z'),
      endDate: new Date('2026-10-05T00:00:00.000Z'),
      approvals: aprobadaPor(todos),
    },
  });

  // Alquiler aprobado con tareas a medio hacer: "2 pendientes de 3".
  await prisma.reservation.create({
    data: {
      assetId: COSTA_ID,
      userId: diego.id,
      renterId: ruiz.id,
      type: 'RENTAL',
      status: 'ACTIVE',
      note: 'Matrimonio con dos nenes.',
      amount: 150000,
      startDate: new Date('2026-11-07T00:00:00.000Z'),
      endDate: new Date('2026-11-09T00:00:00.000Z'),
      createdAt: new Date('2026-09-10T12:00:00.000Z'),
      approvals: aprobadaPor(todos),
      tasks: {
        create: tareas([
          ['Limpieza y cambio de ropa blanca', eva, true],
          ['Revisar el termotanque', nico],
          ['Dejar las llaves en la inmobiliaria', diego],
        ]),
      },
    },
  });

  // En votacion: falta el voto de Nico.
  await prisma.reservation.create({
    data: {
      assetId: COSTA_ID,
      userId: eva.id,
      renterId: mochileros.id,
      type: 'RENTAL',
      note: 'Cuatro chicos de 20, una semana entre Navidad y Año Nuevo.',
      amount: 320000,
      startDate: new Date('2026-12-27T00:00:00.000Z'),
      endDate: new Date('2027-01-02T00:00:00.000Z'),
      createdAt: new Date('2026-09-18T12:00:00.000Z'),
      approvals: aprobadaPor([eva, diego]),
    },
  });

  return [diego, eva, nico];
}

async function main() {
  await limpiar();

  const casa = await sembrarCasaQuinta();
  const costa = await sembrarDeptoCosta();

  const mails = (usuarios) => usuarios.map((u) => u.email).join(', ');
  console.log(`seed ok. Se entra con estos mails y la contraseña "${PASSWORD_DEMO}":`);
  console.log(`  Casa quinta       : ${mails(casa)}`);
  console.log(`  Depto en la costa : ${mails(costa)}`);
}

main()
  .catch((err) => {
    console.error('seed: fallo', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
