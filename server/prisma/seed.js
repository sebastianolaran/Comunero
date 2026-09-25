require('dotenv').config({ quiet: true });
const prisma = require('../src/prisma');
const movementRepo = require('../src/services/movement.repo');
const { validateMovementInput, buildShares } = require('../src/services/movement.rules');
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

// De hijo a padre: borrar un usuario o una reserva que todavia tenga algo
// colgando falla por foreign key. Se limpia todo lo que cuelga de los dos
// bienes, incluso lo que el seed no crea (movimientos, saldos, decisiones):
// si alguien uso la app contra esta base, esas filas existen y apuntan a los
// usuarios que estamos por borrar.
async function limpiar() {
  const deLosBienes = { assetId: { in: ASSET_IDS } };
  const reservas = { reservation: deLosBienes };

  await prisma.movementShare.deleteMany({ where: { movement: deLosBienes } });
  await prisma.movement.deleteMany({ where: deLosBienes });
  await prisma.settlement.deleteMany({ where: deLosBienes });
  await prisma.vote.deleteMany({ where: { decision: deLosBienes } });
  await prisma.decision.deleteMany({ where: deLosBienes });
  await prisma.activityLog.deleteMany({ where: deLosBienes });
  await prisma.renterObservation.deleteMany({ where: { renter: deLosBienes } });
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

// Movimientos de julio a septiembre 2026 que cubren las historias de
// Movimientos: gastos e ingresos, un desglose con reparto por item, repartos
// parciales y dos recurrentes. Internet (julio) es recurrente: sus copias de
// agosto y septiembre no se cargan aca, las genera el server al arrancar o al
// abrir Movimientos.
async function cargarMovimientos({ ana, bruno, carla, flor }) {
  const todos = [ana, bruno, carla, flor].map((u) => u.id);
  const ids = (...usuarios) => usuarios.map((u) => u.id);
  const gasto = (description, amount, date, pagador, shareIds = todos, extra = {}) => ({
    type: 'EXPENSE', description, amount, date, paidById: pagador.id, shareIds, ...extra,
  });
  const ingreso = (description, amount, date, cobrador, shareIds = todos) => ({
    type: 'INCOME', description, amount, date, paidById: cobrador.id, shareIds,
  });

  const movimientos = [
    // Julio
    gasto('Internet', 15000, '2026-07-10', ana, todos, { recurring: true }),
    gasto('Corte de pasto', 15000, '2026-07-15', carla),
    // Agosto: 1 alquiler y 5 gastos (contando la copia de Internet del 01/08)
    gasto('Gas envasado', 18000, '2026-08-05', bruno),
    {
      type: 'EXPENSE',
      description: 'Compra supermercado',
      date: '2026-08-09',
      paidById: bruno.id,
      items: [
        { description: 'Carne', amount: 10000, shareIds: todos },
        { description: 'Verdura', amount: 5000, shareIds: todos },
        { description: 'Bebidas', amount: 2000, shareIds: ids(flor, bruno) },
      ],
    },
    ingreso('Alquiler amigos', 120000, '2026-08-16', bruno),
    gasto('Compra de carbón', 9000, '2026-08-23', ana),
    gasto('Compra de carbón', 9000, '2026-08-23', ana),
    // Septiembre
    gasto('Expensas', 48000, '2026-09-05', flor, todos, { recurring: true }),
    ingreso('Venta de herramientas viejas', 5000, '2026-09-12', ana, ids(ana)),
    ingreso('Alquiler finde', 10000, '2026-09-14', carla, ids(flor, bruno, carla)),
    gasto('Jardinero', 20000, '2026-09-18', carla),
  ];

  for (const body of movimientos) {
    const input = validateMovementInput(body, todos);
    await movementRepo.insertMovement(CASA_ID, input, buildShares(input));
  }
}

const aprobadaPor = (usuarios) => ({ create: usuarios.map((u) => ({ userId: u.id })) });

const soloFecha = (d) => d.toISOString().slice(0, 10);

// Lo mismo que hace "Marcar como pago" en Solicitudes: paidAt en la reserva y
// un ingreso de todos en Movimientos, cobrado por quien gestiona el alquiler.
async function cobrar(reserva, inquilino, todos) {
  await prisma.reservation.update({ where: { id: reserva.id }, data: { paidAt: reserva.endDate } });
  await prisma.movement.create({
    data: {
      assetId: reserva.assetId,
      reservationId: reserva.id,
      type: 'INCOME',
      amount: reserva.amount,
      description: `Alquiler a ${inquilino.name} del ${soloFecha(reserva.startDate)} al ${soloFecha(reserva.endDate)}`,
      date: reserva.endDate,
      paidById: reserva.userId,
      shares: {
        create: buildShares({ amount: reserva.amount, shareIds: todos.map((u) => u.id), paidById: reserva.userId })
          .shares,
      },
    },
  });
}

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
    data: { assetId: CASA_ID, name: 'Martín Suárez', phone: '1154327788', rating: 'RECOMMENDED' },
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
  const alvarezJulio = await prisma.reservation.create({
    data: {
      assetId: CASA_ID,
      userId: bruno.id,
      renterId: alvarez.id,
      type: 'RENTAL',
      status: 'ACTIVE',
      amount: 150000,
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
  const gomezAgosto = await prisma.reservation.create({
    data: {
      assetId: CASA_ID,
      userId: bruno.id,
      renterId: gomez.id,
      type: 'RENTAL',
      status: 'ACTIVE',
      amount: 60000,
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
      // Ya pasó y no se cobró: queda "Pendiente" para marcarlo como pago.
      amount: 150000,
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
      amount: 70000,
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
      amount: 210000,
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

  await cargarMovimientos({ ana, bruno, carla, flor });
  // Historial de inquilinos: solo cuentan los alquileres aprobados cuyo último
  // día ya pasó. Lucía Gómez (solo uno aprobado a futuro) no tiene que aparecer.
  const aprobado = async (renter, desde, hasta, { monto = 120000, gestor = ana, pagado = true } = {}) => {
    const reserva = await prisma.reservation.create({
      data: {
        assetId: CASA_ID,
        userId: gestor.id,
        renterId: renter.id,
        type: 'RENTAL',
        status: 'ACTIVE',
        amount: monto,
        startDate: new Date(`${desde}T00:00:00.000Z`),
        endDate: new Date(`${hasta}T00:00:00.000Z`),
        createdAt: new Date(`${desde}T00:00:00.000Z`),
        approvals: aprobadaPor(todos),
      },
    });
    if (pagado) await cobrar(reserva, renter, todos);
    return reserva;
  };

  const [lucas, luciaF, lucrecia, lucio] = await Promise.all(
    [
      { name: 'Lucas Benítez', phone: '1123669503', rating: 'RECOMMENDED' },
      { name: 'Lucía Fernández', phone: '1140000002' },
      { name: 'Lucrecia Paz', phone: '1140000003', rating: 'RECOMMENDED' },
      { name: 'Lucio Ramírez', phone: '1140000004', rating: 'NOT_RECOMMENDED' },
    ].map((r) => prisma.renter.create({ data: { ...r, assetId: CASA_ID } })),
  );
  await prisma.renter.update({ where: { id: alvarez.id }, data: { rating: 'NOT_RECOMMENDED' } });

  const martinEnero = await aprobado(martin, '2026-01-10', '2026-01-12', { monto: 90000 });
  // Lucas: dos terminados y uno aprobado para noviembre, que no cuenta.
  const lucasMarzo = await aprobado(lucas, '2026-03-06', '2026-03-08', { gestor: bruno });
  await aprobado(lucas, '2026-06-19', '2026-06-21', { monto: 130000, gestor: carla });
  await aprobado(lucas, '2026-11-21', '2026-11-23', { monto: 140000, pagado: false });
  await aprobado(luciaF, '2026-02-14', '2026-02-16', { monto: 100000, gestor: flor });
  await aprobado(lucrecia, '2026-04-02', '2026-04-05', { monto: 160000 });
  const lucioMayo = await aprobado(lucio, '2026-05-23', '2026-05-25', { gestor: bruno });

  await cobrar(alvarezJulio, alvarez, todos);
  await cobrar(gomezAgosto, gomez, todos);

  // Observaciones: una suelta y otras atadas al alquiler del que hablan.
  const observacion = (renter, autor, text, fecha, reserva) =>
    prisma.renterObservation.create({
      data: {
        renterId: renter.id,
        authorId: autor.id,
        reservationId: reserva?.id ?? null,
        text,
        createdAt: new Date(`${fecha}T15:00:00.000Z`),
      },
    });
  await observacion(martin, ana, 'Devolvió la llave a tiempo', '2026-01-13', martinEnero);
  await observacion(lucas, bruno, 'Dejaron todo impecable, hasta lavaron la vajilla.', '2026-03-09', lucasMarzo);
  await observacion(lucas, carla, 'Volvería a alquilarle sin dudarlo.', '2026-06-22');
  await observacion(lucio, bruno, 'Música fuerte hasta la madrugada, se quejaron los vecinos.', '2026-05-26', lucioMayo);
  await observacion(alvarez, flor, 'Rompieron una reposera y la pileta quedó sucia.', '2026-07-13', alvarezJulio);

  // Solicitudes que muestran el resto de los estados:

  const [castro, medina, quiroga] = await Promise.all(
    [
      { name: 'Familia Castro', phone: '5491155550007' },
      { name: 'Familia Medina', phone: '5491155550008' },
      { name: 'Grupo Quiroga', phone: '5491155550009' },
    ].map((r) => prisma.renter.create({ data: { ...r, assetId: CASA_ID } })),
  );

  // Falta el voto de Ana: al entrar con ana@ se puede aprobar o rechazar.
  await prisma.reservation.create({
    data: {
      assetId: CASA_ID,
      userId: bruno.id,
      renterId: castro.id,
      type: 'RENTAL',
      note: 'Aniversario de casados, 4 adultos.',
      amount: 200000,
      startDate: new Date('2026-11-27T00:00:00.000Z'),
      endDate: new Date('2026-11-29T00:00:00.000Z'),
      createdAt: new Date('2026-09-20T12:00:00.000Z'),
      approvals: aprobadaPor([bruno, carla]),
    },
  });

  // Aprobado y después cancelado (antes de cobrarlo).
  await prisma.reservation.create({
    data: {
      assetId: CASA_ID,
      userId: bruno.id,
      renterId: medina.id,
      type: 'RENTAL',
      status: 'CANCELLED',
      rejectionReason: 'Alquiler cancelado por Bruno',
      note: 'Se les cayó el viaje.',
      amount: 110000,
      startDate: new Date('2026-10-31T00:00:00.000Z'),
      endDate: new Date('2026-11-02T00:00:00.000Z'),
      createdAt: new Date('2026-09-02T12:00:00.000Z'),
      approvals: aprobadaPor(todos),
    },
  });

  // Rechazada sola al aprobarse el cumpleaños de Lucía Gómez (1 al 3/12).
  await prisma.reservation.create({
    data: {
      assetId: CASA_ID,
      userId: carla.id,
      renterId: quiroga.id,
      type: 'RENTAL',
      status: 'REJECTED',
      rejectionReason: 'Rechazada por solapamiento con un alquiler aprobado en esas fechas',
      note: 'Despedida de soltero, 10 personas.',
      amount: 260000,
      startDate: new Date('2026-12-02T00:00:00.000Z'),
      endDate: new Date('2026-12-04T00:00:00.000Z'),
      createdAt: new Date('2026-08-28T12:00:00.000Z'),
      approvals: aprobadaPor([carla]),
    },
  });

  // Uso propio de Flor esperando el voto de Ana (Calendario).
  await prisma.reservation.create({
    data: {
      assetId: CASA_ID,
      userId: flor.id,
      type: 'USE',
      note: 'Voy con amigas a descansar.',
      startDate: new Date('2026-10-17T00:00:00.000Z'),
      endDate: new Date('2026-10-18T00:00:00.000Z'),
      approvals: aprobadaPor([flor, bruno, carla]),
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
