require('dotenv').config({ quiet: true });
const fs = require('node:fs');
const path = require('node:path');
const prisma = require('../src/prisma');
const movementRepo = require('../src/services/movement.repo');
const { validateMovementInput, buildShares } = require('../src/services/movement.rules');
const { hashPassword } = require('../src/lib/password');
const balanceRepo = require('../src/services/balance.repo');
const balanceRules = require('../src/services/balance.rules');

// Bien para mostrar en vivo, aparte del seed de pruebas: solo toca filas demo-*.
// Las fechas salen del día en que se corre, así que conviene correrlo antes de
// cada demo (las pendientes vencen a las 72 h).
const ASSET_ID = 'demo-quinta-aromos';
const PASSWORD = 'demo2026';
const SLUG = 'quinta-los-aromos';
const TARIFA = 60000;

const USUARIOS = [
  { id: 'demo-martina', name: 'Martina', email: 'martina@comunero.demo', phone: '5492494000001' },
  { id: 'demo-joaquin', name: 'Joaquín', email: 'joaquin@comunero.demo', phone: '5492494000002' },
  { id: 'demo-valentina', name: 'Valentina', email: 'valentina@comunero.demo', phone: '5492494000003' },
  { id: 'demo-tomas', name: 'Tomás', email: 'tomas@comunero.demo', phone: '5492494000004' },
];
const USER_IDS = USUARIOS.map((u) => u.id);

const HOY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
const [ANIO, MES, DIA] = HOY.split('-').map(Number);
const dia = (offset) => new Date(Date.UTC(ANIO, MES - 1, DIA + offset));
const fecha = (offset) => dia(offset).toISOString().slice(0, 10);
// A media tarde del día, para que createdAt y resolvedAt no caigan todos a medianoche.
const momento = (offset) => new Date(dia(offset).getTime() + 15 * 3600_000);
const haceHoras = (horas) => new Date(Date.now() - horas * 3600_000);

async function limpiar() {
  const creadosEnLaApp = await prisma.asset.findMany({
    where: { users: { some: { id: { in: USER_IDS } } } },
    select: { id: true },
  });
  const bienes = [...new Set([ASSET_ID, ...creadosEnLaApp.map((a) => a.id)])];
  const deLosBienes = { assetId: { in: bienes } };
  const reservas = { reservation: deLosBienes };

  await prisma.reservationSwap.deleteMany({ where: deLosBienes });
  await prisma.movement.deleteMany({ where: deLosBienes });
  await prisma.settlement.deleteMany({ where: deLosBienes });
  await prisma.vote.deleteMany({ where: { decision: deLosBienes } });
  await prisma.decision.deleteMany({ where: deLosBienes });
  await prisma.activityLog.deleteMany({ where: deLosBienes });
  await prisma.assetMemberSetting.deleteMany({ where: deLosBienes });
  await prisma.listingPhoto.deleteMany({ where: deLosBienes });
  await prisma.assetListing.deleteMany({ where: deLosBienes });
  await prisma.renterObservation.deleteMany({ where: { renter: deLosBienes } });
  await prisma.reservationApproval.deleteMany({ where: reservas });
  await prisma.objection.deleteMany({ where: reservas });
  await prisma.rentalTask.deleteMany({ where: reservas });
  await prisma.reservation.deleteMany({ where: deLosBienes });
  await prisma.renter.deleteMany({ where: deLosBienes });
  await prisma.asset.deleteMany({ where: { id: { in: bienes } } });
  await prisma.user.deleteMany({ where: { id: { in: USER_IDS } } });
}

async function crearBien() {
  await prisma.asset.create({
    data: {
      id: ASSET_ID,
      name: 'Quinta Los Aromos',
      inviteCode: 'AROMOS-26',
      rentalDailyRate: TARIFA,
      maxConsecutiveDays: 7,
      responseHours: 72,
    },
  });
  const usuarios = await Promise.all(
    USUARIOS.map(async (u) =>
      prisma.user.create({
        data: { ...u, assets: { connect: { id: ASSET_ID } }, passwordHash: await hashPassword(PASSWORD) },
      }),
    ),
  );
  return Object.fromEntries(usuarios.map((u) => [u.id.replace('demo-', ''), u]));
}

const INQUILINOS = [
  ['Familia Benítez', '5492494551001', null, 'RECOMMENDED'],
  ['Lucas Ferreyra', '5491155552002', null, 'NOT_RECOMMENDED'],
  ['Carolina Méndez', '5491155553003', null, null],
  ['Familia Acosta', '5492494554004', null, 'RECOMMENDED'],
  ['Sofía Romero', '5491155555005', null, null],
  ['Federico Paz', '5491155556006', null, null],
  ['Grupo Quiroga', '5491155557007', null, null],
  ['Familia Ortiz', '5492494558008', null, null],
  ['Gabriela Sosa', '5491161234567', 'gabisosa@gmail.com', null],
];

async function crearInquilinos() {
  const lista = await Promise.all(
    INQUILINOS.map(([name, phone, email, rating]) =>
      prisma.renter.create({ data: { assetId: ASSET_ID, name, phone, email, rating } }),
    ),
  );
  return Object.fromEntries(lista.map((r) => [r.name, r]));
}

// Cada reserva: [desde, hasta] en días desde hoy. aprobaron/objetaron: usuarios.
async function reserva({ tipo, estado, desde, hasta, de, inquilino, monto, nota, motivo, huespedes, aprobaron = [], objetaron = [], creada }) {
  return prisma.reservation.create({
    data: {
      assetId: ASSET_ID,
      userId: de?.id ?? null,
      renterId: inquilino?.id ?? null,
      type: tipo,
      status: estado,
      startDate: dia(desde),
      endDate: dia(hasta),
      amount: monto ?? null,
      note: nota ?? null,
      rejectionReason: motivo ?? null,
      guests: huespedes ?? null,
      createdAt: creada ?? momento(desde - 14),
      approvals: { create: aprobaron.map((u) => ({ userId: u.id })) },
      objections: { create: objetaron.map(([u, reason]) => ({ userId: u.id, reason: reason ?? null })) },
    },
  });
}

async function cobrar(alquiler, inquilino, todos) {
  await prisma.reservation.update({ where: { id: alquiler.id }, data: { paidAt: alquiler.endDate } });
  const desde = alquiler.startDate.toISOString().slice(0, 10);
  const hasta = alquiler.endDate.toISOString().slice(0, 10);
  await prisma.movement.create({
    data: {
      assetId: ASSET_ID,
      reservationId: alquiler.id,
      type: 'INCOME',
      amount: alquiler.amount,
      description: `Alquiler a ${inquilino.name} del ${desde} al ${hasta}`,
      date: alquiler.endDate,
      paidById: alquiler.userId,
      shares: { create: buildShares({ amount: alquiler.amount, shareIds: todos, paidById: alquiler.userId }).shares },
    },
  });
}

async function tareas(alquiler, lista) {
  for (const [i, [name, responsable, hecha]] of lista.entries()) {
    const createdAt = new Date(alquiler.createdAt.getTime() + (i + 1) * 60_000);
    await prisma.rentalTask.create({
      data: { reservationId: alquiler.id, assignedToId: responsable.id, name, completed: hecha, completedAt: hecha ? createdAt : null, createdAt },
    });
  }
}

async function cargarReservas(u, inq) {
  const { martina, joaquin, valentina, tomas } = u;
  const todos = [martina, joaquin, valentina, tomas];
  const todosIds = todos.map((x) => x.id);
  const r = {};

  // Historial
  r.benitez1 = await reserva({ tipo: 'RENTAL', estado: 'ACTIVE', desde: -78, hasta: -76, de: joaquin, inquilino: inq['Familia Benítez'], monto: 3 * 50000, nota: 'Matrimonio con tres chicos.', aprobaron: todos });
  r.ferreyra = await reserva({ tipo: 'RENTAL', estado: 'ACTIVE', desde: -57, hasta: -55, de: martina, inquilino: inq['Lucas Ferreyra'], monto: 3 * 50000, nota: 'Seis amigos, despedida.', aprobaron: todos });
  r.usoJoaquin = await reserva({ tipo: 'USE', estado: 'ACTIVE', desde: -43, hasta: -41, de: joaquin, nota: 'Asado con la familia.', aprobaron: todos });
  r.benitez2 = await reserva({ tipo: 'RENTAL', estado: 'ACTIVE', desde: -36, hasta: -34, de: valentina, inquilino: inq['Familia Benítez'], monto: 3 * TARIFA, aprobaron: todos });
  await reserva({ tipo: 'USE', estado: 'REJECTED', desde: -22, hasta: -21, de: valentina, aprobaron: [valentina], objetaron: [[tomas, 'Ese finde viene el de la pileta a hacer el mantenimiento.']] });
  r.usoMartina = await reserva({ tipo: 'USE', estado: 'ACTIVE', desde: -15, hasta: -13, de: martina, nota: 'Fin de semana tranquilo.', aprobaron: todos });
  // Terminó y todavía no está cobrado: para mostrar "Marcar como pago".
  r.mendez = await reserva({ tipo: 'RENTAL', estado: 'ACTIVE', desde: -8, hasta: -6, de: tomas, inquilino: inq['Carolina Méndez'], monto: 3 * TARIFA, nota: 'Pareja con un perro chico.', aprobaron: todos });

  // Lo que viene. Libres a propósito: +10 a +12 y +20 a +22, para reservar en vivo.
  // Valentina lo tiene por un intercambio ya aceptado con Joaquín (ver cargarIntercambios).
  r.usoValentina = await reserva({ tipo: 'USE', estado: 'ACTIVE', desde: 3, hasta: 5, de: valentina, nota: 'Cumpleaños de mi vieja.', aprobaron: todos });
  await reserva({ tipo: 'RENTAL', estado: 'CANCELLED', desde: 6, hasta: 7, de: tomas, inquilino: inq['Familia Ortiz'], monto: 2 * TARIFA, nota: 'Se les complicó el viaje.', motivo: 'Alquiler cancelado por Tomás', aprobaron: todos });
  // Por votar: falta el voto de Martina y Valentina.
  r.pendienteTomas = await reserva({ tipo: 'USE', estado: 'PENDING', desde: 8, hasta: 9, de: tomas, nota: 'Voy a arreglar la persiana del cuarto.', aprobaron: [tomas, joaquin], creada: haceHoras(20) });
  // Se pisa con el de Tomás: dos pendientes el mismo día; si se aprueba uno, el otro se rechaza solo.
  await reserva({ tipo: 'USE', estado: 'PENDING', desde: 7, hasta: 8, de: valentina, nota: 'Viene mi hermana de visita.', aprobaron: [valentina], creada: haceHoras(10) });
  r.acosta = await reserva({ tipo: 'RENTAL', estado: 'ACTIVE', desde: 13, hasta: 15, de: martina, inquilino: inq['Familia Acosta'], monto: 3 * TARIFA, nota: 'Vuelven, el año pasado dejaron todo impecable.', aprobaron: todos });
  await reserva({ tipo: 'RENTAL', estado: 'REJECTED', desde: 14, hasta: 15, de: joaquin, inquilino: inq['Grupo Quiroga'], monto: 2 * TARIFA, nota: 'Despedida de soltero, 10 personas.', motivo: 'Rechazada por solapamiento con una reserva aprobada en esas fechas', aprobaron: [joaquin] });
  // Turnos de 3 días para proponer un intercambio en vivo: Martina ofrece el
  // suyo (+17) por el de Joaquín (+24).
  r.turnoMartina3 = await reserva({ tipo: 'USE', estado: 'ACTIVE', desde: 17, hasta: 19, de: martina, nota: 'Con amigas, somos cinco.', aprobaron: todos });
  r.turnoJoaquin3 = await reserva({ tipo: 'USE', estado: 'ACTIVE', desde: 24, hasta: 26, de: joaquin, aprobaron: todos });
  await reserva({ tipo: 'USE', estado: 'REJECTED', desde: 27, hasta: 29, de: valentina, motivo: 'Venció el plazo para responder', aprobaron: [valentina, joaquin], creada: momento(-6) });
  // Turnos de 2 días con un intercambio pendiente que Tomás le propuso a Martina.
  r.turnoTomas2 = await reserva({ tipo: 'USE', estado: 'ACTIVE', desde: 31, hasta: 32, de: tomas, nota: 'Pesca con mi viejo.', aprobaron: todos });
  r.turnoMartina2 = await reserva({ tipo: 'USE', estado: 'ACTIVE', desde: 38, hasta: 39, de: martina, aprobaron: todos });
  // Llegó por la ficha pública hace unas horas: sin dueño y sin votos.
  r.sosa = await reserva({ tipo: 'RENTAL', estado: 'PENDING', desde: 45, hasta: 47, inquilino: inq['Gabriela Sosa'], monto: 3 * TARIFA, huespedes: 6, nota: 'Somos dos familias con cuatro chicos. ¿Se puede llegar el viernes a la mañana?', creada: haceHoras(3) });
  // Alquiler cargado por Joaquín, falta que voten Martina y Tomás.
  r.romero = await reserva({ tipo: 'RENTAL', estado: 'PENDING', desde: 52, hasta: 53, de: joaquin, inquilino: inq['Sofía Romero'], monto: 2 * TARIFA, nota: 'Cumpleaños de 30, 12 personas de día.', aprobaron: [joaquin, valentina], creada: haceHoras(30) });
  await reserva({ tipo: 'RENTAL', estado: 'REJECTED', desde: 60, hasta: 62, inquilino: inq['Federico Paz'], monto: 3 * TARIFA, huespedes: 4, nota: 'Familia de cuatro, recomendados por los Benítez.', motivo: 'Venció el plazo para responder', aprobaron: [valentina, tomas], creada: momento(-9) });
  // Pedido propio de Martina, esperando a los demás.
  await reserva({ tipo: 'USE', estado: 'PENDING', desde: 66, hasta: 67, de: martina, nota: 'Año nuevo con la familia.', aprobaron: [martina], creada: haceHoras(1) });

  await cobrar(r.benitez1, inq['Familia Benítez'], todosIds);
  await cobrar(r.ferreyra, inq['Lucas Ferreyra'], todosIds);
  await cobrar(r.benitez2, inq['Familia Benítez'], todosIds);

  await tareas(r.benitez1, [['Limpieza profunda de la casa', valentina, true], ['Clorar la pileta', tomas, true]]);
  await tareas(r.ferreyra, [['Limpieza previa', martina, true], ['Dejar leña y carbón', joaquin, true]]);
  await tareas(r.mendez, [['Limpieza previa', valentina, true], ['Revisar la pileta', tomas, true], ['Dejar las llaves en la caja', tomas, true]]);
  await tareas(r.acosta, [
    ['Limpieza profunda de la casa', valentina, true],
    ['Clorar y limpiar la pileta', tomas, true],
    ['Cambiar sábanas y toallas', martina, false],
    ['Reponer gas y carbón', joaquin, false],
    ['Cortar el pasto', tomas, false],
  ]);

  const obs = (inquilino, autor, text, alquiler = null) =>
    prisma.renterObservation.create({ data: { renterId: inquilino.id, authorId: autor.id, text, reservationId: alquiler?.id ?? null } });
  await obs(inq['Familia Benítez'], joaquin, 'Dejaron todo impecable y devolvieron la llave a horario.', r.benitez1);
  await obs(inq['Familia Benítez'], valentina, 'Muy cuidadosos con la pileta. Volvería a alquilarles.', r.benitez2);
  await obs(inq['Lucas Ferreyra'], martina, 'Música fuerte hasta la madrugada y una reposera rota.', r.ferreyra);
  await obs(inq['Familia Acosta'], martina, 'Avisaron que llegan el viernes tarde.', r.acosta);

  return r;
}

// Intercambios: uno aceptado (los turnos ya quedaron cambiados), uno
// rechazado y uno pendiente para que Martina lo responda en vivo.
async function cargarIntercambios(u, r) {
  const swap = (data) => prisma.reservationSwap.create({ data: { assetId: ASSET_ID, ...data } });
  await swap({
    offeredReservationId: r.usoValentina.id,
    requestedReservationId: r.turnoJoaquin3.id,
    proposedById: u.joaquin.id,
    recipientId: u.valentina.id,
    status: 'ACCEPTED',
    createdAt: momento(-12),
    resolvedAt: momento(-11),
  });
  await swap({
    offeredReservationId: r.usoValentina.id,
    requestedReservationId: r.turnoMartina3.id,
    proposedById: u.valentina.id,
    recipientId: u.martina.id,
    status: 'REJECTED',
    createdAt: momento(-5),
    resolvedAt: momento(-4),
  });
  await swap({
    offeredReservationId: r.turnoTomas2.id,
    requestedReservationId: r.turnoMartina2.id,
    proposedById: u.tomas.id,
    recipientId: u.martina.id,
    status: 'PENDING',
    createdAt: haceHoras(5),
  });
}

async function cargarMovimientos(u) {
  const todos = USER_IDS;
  const gasto = (description, amount, offset, pagador, shareIds = todos) => ({
    type: 'EXPENSE', description, amount, date: fecha(offset), paidById: pagador.id, shareIds,
  });
  const ingreso = (description, amount, offset, cobrador) => ({
    type: 'INCOME', description, amount, date: fecha(offset), paidById: cobrador.id, shareIds: todos,
  });
  const movimientos = [
    gasto('Internet', 18000, -88, u.martina),
    gasto('Luz', 32000, -85, u.joaquin),
    gasto('Expensas del barrio', 45000, -83, u.valentina),
    gasto('Jardinero', 25000, -75, u.tomas),
    gasto('Internet', 18000, -58, u.martina),
    gasto('Luz', 29500, -55, u.joaquin),
    gasto('Expensas del barrio', 45000, -53, u.valentina),
    {
      type: 'EXPENSE',
      description: 'Compra para el finde',
      date: fecha(-42),
      paidById: u.joaquin.id,
      items: [
        { description: 'Carne y achuras', amount: 28000, shareIds: todos },
        { description: 'Verdura', amount: 6000, shareIds: todos },
        { description: 'Vino y cerveza', amount: 12000, shareIds: [u.joaquin.id, u.tomas.id] },
      ],
    },
    gasto('Mantenimiento de la pileta', 38000, -39, u.tomas),
    gasto('Arreglo del calefón', 65000, -31, u.martina),
    gasto('Internet', 18000, -28, u.martina),
    gasto('Luz', 34000, -25, u.joaquin),
    gasto('Expensas del barrio', 47000, -23, u.valentina),
    ingreso('Venta de la heladera vieja', 40000, -18, u.tomas),
    gasto('Leña', 12000, -14, u.valentina, [u.martina.id, u.valentina.id]),
    gasto('Jardinero', 25000, -9, u.tomas),
  ];
  for (const body of movimientos) {
    const input = validateMovementInput(body, todos);
    await movementRepo.insertMovement(ASSET_ID, input, buildShares(input));
  }
}

// Saldo cerrado con fecha pasada, como lo deja "Saldar deuda total".
async function cerrarEntre(a, b, offset) {
  const hasta = momento(offset);
  const aLaFecha = async (desde) => ({
    movements: (await balanceRepo.findMovementsOf(ASSET_ID, desde.id)).filter((m) => m.date <= hasta),
    settlements: (await balanceRepo.findSettlementsOf(ASSET_ID, desde.id)).filter((s) => s.date <= hasta),
  });
  const desdeA = await aLaFecha(a);
  const { balance } = balanceRules.computeBalanceWith(a.id, b, desdeA.movements, desdeA.settlements);
  if (balance === 0) return;
  const [deudor, acreedor] = balance < 0 ? [a, b] : [b, a];
  const { movements, settlements } = deudor === a ? desdeA : await aLaFecha(b);
  const closing = balanceRules.buildClosing(deudor.id, acreedor, movements, settlements, Math.abs(balance));
  const cierre = await balanceRepo.createClosing({ assetId: ASSET_ID, fromUserId: deudor.id, toUserId: acreedor.id, ...closing }, prisma);
  await prisma.settlement.update({ where: { id: cierre.id }, data: { date: hasta } });
}

async function cargarPagos(u) {
  const parcial = (de, a, amount, offset) =>
    prisma.settlement.create({ data: { assetId: ASSET_ID, fromUserId: de.id, toUserId: a.id, amount, date: momento(offset) } });
  await cerrarEntre(u.martina, u.joaquin, -33);
  await parcial(u.martina, u.tomas, 4000, -11);
  await parcial(u.valentina, u.joaquin, 1000, -7);
  await cerrarEntre(u.martina, u.tomas, -2);
}

async function cargarDecisiones(u) {
  const votos = (si, no = []) => ({
    create: [...si.map((x) => ({ userId: x.id, value: 'YES' })), ...no.map((x) => ({ userId: x.id, value: 'NO' }))],
  });
  const cerrada = (abierta, dias) => ({ createdAt: momento(abierta), closedAt: momento(abierta + dias), votesNeededAtClose: 4 });
  const decisiones = [
    // Abierta: falta el voto de Martina y Valentina.
    { title: 'Cambiar la bomba de la pileta', description: 'La actual hace ruido y no llega a filtrar toda el agua. Hay un presupuesto de Aguas Claras.', proposedById: u.tomas.id, status: 'OPEN', estimatedType: 'EXPENSE', estimatedAmount: 220000, createdAt: haceHoras(26), votes: votos([u.tomas, u.joaquin]) },
    { title: 'Pintar la galería antes del verano', description: 'Se hace entre todos un fin de semana; el monto es la pintura y los rodillos.', proposedById: u.martina.id, status: 'REJECTED', estimatedType: 'EXPENSE', estimatedAmount: 90000, ...cerrada(-4, 1), votes: votos([u.valentina], [u.martina]) },
    { title: 'Contratar un seguro contra robo', description: 'Cubre la casa y lo que hay adentro. Se paga por mes.', proposedById: u.valentina.id, status: 'APPROVED', estimatedType: 'EXPENSE', estimatedAmount: 35000, ...cerrada(-27, 3), votes: votos([u.martina, u.joaquin, u.valentina, u.tomas]) },
    { title: 'Subir el precio del alquiler a $80.000 por día', description: 'Para la temporada de verano.', proposedById: u.joaquin.id, status: 'REJECTED', ...cerrada(-45, 2), votes: votos([u.joaquin, u.martina], [u.valentina]) },
    { title: 'Alquilarle la quinta a la escuela de natación', description: 'Usan la pileta los martes y jueves de enero a la mañana.', proposedById: u.martina.id, status: 'APPROVED', estimatedType: 'INCOME', estimatedAmount: 300000, ...cerrada(-61, 3), votes: votos([u.martina, u.joaquin, u.valentina, u.tomas]) },
    { title: 'Horario de silencio desde las 23 h', description: 'Para no tener más quejas de los vecinos.', proposedById: u.valentina.id, status: 'APPROVED', ...cerrada(-71, 2), votes: votos([u.martina, u.joaquin, u.valentina, u.tomas]) },
  ];
  for (const d of decisiones) await prisma.decision.create({ data: { ...d, assetId: ASSET_ID } });
}

async function cargarFicha(u) {
  await prisma.assetListing.create({
    data: {
      assetId: ASSET_ID,
      publicSlug: SLUG,
      published: true,
      description:
        'Casa quinta con parque arbolado de 2.500 m², pileta de 8 × 4 y quincho cerrado con parrilla. La casa tiene tres dormitorios, dos baños, living con hogar y cocina equipada. Ideal para escapadas en familia o reuniones de fin de semana.',
      capacity: 10,
      services: ['Pileta', 'Quincho con parrilla', 'Wi-Fi', 'Estacionamiento para 4 autos', 'Ropa de cama y toallas', 'Aire acondicionado'],
      approxLocation: 'Tandil, Buenos Aires · a 10 minutos del centro',
      conditions:
        'Ingreso desde las 11 y salida hasta las 18. Sin música fuerte después de las 0. Se aceptan mascotas chicas. Seña del 30 % para confirmar la reserva.',
    },
  });
  // Pileta y quincho, con licencia CC (créditos en la memoria del proyecto).
  const fotos = ['pileta.jpg', 'quincho.jpg'];
  for (const [position, archivo] of fotos.entries()) {
    const data = fs.readFileSync(path.join(__dirname, 'demo-fotos', archivo));
    await prisma.listingPhoto.create({ data: { assetId: ASSET_ID, position, mimeType: 'image/jpeg', data } });
  }

  const log = (userId, offset, changes, type = 'SETTINGS_CHANGED') =>
    prisma.activityLog.create({ data: { assetId: ASSET_ID, userId, type, payload: { changes }, createdAt: momento(offset) } });
  await log(u.joaquin.id, -73, [{ field: 'rentalDailyRate', from: null, to: 50000 }, { field: 'maxConsecutiveDays', from: null, to: 7 }]);
  await log(u.martina.id, -48, [{ field: 'rentalDailyRate', from: 50000, to: TARIFA }]);
  await log(u.valentina.id, -13, [{ field: 'responseHours', from: null, to: 72 }]);
}

async function main() {
  await limpiar();
  const u = await crearBien();
  const inq = await crearInquilinos();
  const r = await cargarReservas(u, inq);
  await cargarIntercambios(u, r);
  await cargarMovimientos(u);
  await cargarPagos(u);
  await cargarDecisiones(u);
  await cargarFicha(u);

  console.log(`demo ok (hoy ${HOY}). Contraseña "${PASSWORD}": ${USUARIOS.map((x) => x.email).join(', ')}`);
  console.log(`Ficha: /ficha/${SLUG} · para compartir: /f/${SLUG}`);
  console.log(`Libres para reservar en vivo: ${fecha(10)} a ${fecha(12)} y ${fecha(20)} a ${fecha(22)}`);
}

main()
  .catch((err) => {
    console.error('demo: falló', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
