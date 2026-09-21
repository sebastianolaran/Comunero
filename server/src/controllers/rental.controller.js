const reservationService = require('../services/reservation.service');
const rentalService = require('../services/rental.service');
const { parseFechaISO, cantidadDias } = require('../lib/fecha');

const MODOS_MONTO = new Set(['TOTAL', 'POR_DIA']);

// POST /api/reservations/rental
// body: { assetId, userId, startDate, endDate, renterName, renterPhone,
//         montoModo: 'TOTAL' | 'POR_DIA', monto, note? }
//
// Historia "Solicitar alquiler a terceros". A diferencia de "uso propio",
// aca la fecha de inicio tiene que ser ESTRICTAMENTE anterior a la de fin
// (regla 2 de esta tarjeta dice "anterior a", no "anterior o igual a").
//
// El monto no se guarda en Reservation (ese campo, depositAmount, es la
// SEÑA, otro concepto): se registra como un Movement type=INCOME vinculado
// a la reserva, tal como indica el comentario del propio schema.
//
// TODO: mismo TODO que en reservation.controller.js sobre userId sin auth.
async function create(req, res) {
  const {
    assetId,
    userId,
    startDate,
    endDate,
    renterName,
    renterPhone,
    montoModo,
    monto,
    note,
  } = req.body ?? {};

  if (!assetId || !userId) {
    return res.status(400).json({ error: 'faltan assetId y/o userId' });
  }

  const inicio = parseFechaISO(startDate);
  const fin = parseFechaISO(endDate);
  if (!inicio || !fin) {
    return res
      .status(400)
      .json({ error: 'faltan o son invalidas startDate/endDate (formato esperado YYYY-MM-DD)' });
  }
  // Regla 2: estricto, no admite inicio == fin.
  if (inicio.getTime() >= fin.getTime()) {
    return res.status(400).json({ error: 'startDate debe ser anterior a endDate' });
  }

  // Regla 4: el nombre del tercero es obligatorio.
  const nombreTercero = typeof renterName === 'string' ? renterName.trim() : '';
  if (!nombreTercero) {
    return res.status(400).json({ error: 'falta el nombre del tercero (renterName)' });
  }
  if (!renterPhone) {
    // No esta en los ejemplos de la tarjeta, pero Renter.phone es
    // obligatorio en el schema: si no viene, no se puede crear el tercero.
    return res.status(400).json({ error: 'falta el telefono del tercero (renterPhone)' });
  }

  // Regla 5 + 6: hay que indicar el modo del monto, y el monto es
  // obligatorio y positivo.
  if (!MODOS_MONTO.has(montoModo)) {
    return res
      .status(400)
      .json({ error: "montoModo invalido, debe ser 'TOTAL' o 'POR_DIA'" });
  }
  const montoNumerico = Number(monto);
  if (!Number.isFinite(montoNumerico) || montoNumerico <= 0) {
    return res.status(400).json({ error: 'monto es obligatorio y debe ser positivo' });
  }

  const dias = cantidadDias(inicio, fin);
  const montoTotal =
    montoModo === 'POR_DIA' ? Math.round(montoNumerico * dias) : Math.round(montoNumerico);

  // Regla 3: no se puede solapar con otra reserva/solicitud vigente
  // (mismo chequeo que "uso propio", es generico por asset y fechas).
  const solapa = await reservationService.hasOverlap(assetId, inicio, fin);
  if (solapa) {
    return res.status(409).json({
      error: 'el rango solicitado incluye dias ya ocupados por otra reserva o solicitud pendiente',
    });
  }

  const renter = await rentalService.findOrCreateRenter(assetId, nombreTercero, renterPhone);

  const { reservation, movement } = await rentalService.requestRental({
    assetId,
    userId,
    renterId: renter.id,
    startDate: inicio,
    endDate: fin,
    note,
    montoTotal,
    descripcionMovimiento: `Alquiler a ${nombreTercero} (${startDate} a ${endDate})`,
  });

  res.status(201).json({ reservation, movement, renter });
}

module.exports = { create };
