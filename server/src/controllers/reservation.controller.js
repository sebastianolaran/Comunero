const reservationService = require('../services/reservation.service');
const { parseFechaISO } = require('../lib/fecha');

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// GET /api/reservations?assetId=...&month=YYYY-MM
//
// Historia "Consultar calendario": devuelve las reservas que se solapan con
// el mes pedido, para que el client derive el estado de cada dia (libre,
// reservado, alquilado, rechazado). El calculo de "que color va en cada
// dia" queda del lado del client: este endpoint solo entrega los datos.
async function listForCalendar(req, res) {
  const { assetId, month } = req.query;

  if (!assetId) {
    return res.status(400).json({ error: 'falta el parametro assetId' });
  }
  if (!month || !MONTH_RE.test(month)) {
    return res
      .status(400)
      .json({ error: 'falta o es invalido el parametro month (formato esperado YYYY-MM)' });
  }

  const [year, monthNum] = month.split('-').map(Number);
  // Rango del mes en UTC: primer dia 00:00:00 al ultimo dia 23:59:59.999.
  // Usamos UTC (y no el huso local del server) para que "agosto" sea el
  // mismo rango sin importar donde corra el proceso.
  const rangeStart = new Date(Date.UTC(year, monthNum - 1, 1));
  const rangeEnd = new Date(Date.UTC(year, monthNum, 0, 23, 59, 59, 999));

  const reservations = await reservationService.listForRange(assetId, rangeStart, rangeEnd);

  res.json({ reservations });
}

// POST /api/reservations
// body: { assetId, userId, startDate, endDate, note? }  (fechas 'YYYY-MM-DD')
//
// Historia "Solicitar turno de uso propio". type queda fijo en USE: alquilar
// a un tercero es otra historia, no se mezcla aca.
//
// TODO: cuando exista auth, el userId tiene que salir de la sesion (no
// confiar en el body) para que la regla "la solicitud corresponde a quien
// la realiza" sea real y no solo un dato declarado por el client.
async function create(req, res) {
  const { assetId, userId, startDate, endDate, note } = req.body ?? {};

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
  if (inicio.getTime() > fin.getTime()) {
    return res.status(400).json({ error: 'startDate debe ser anterior o igual a endDate' });
  }

  const solapa = await reservationService.hasOverlap(assetId, inicio, fin);
  if (solapa) {
    return res.status(409).json({
      error: 'el rango solicitado incluye dias ya ocupados por otra reserva o solicitud pendiente',
    });
  }

  const reservation = await reservationService.requestUse({
    assetId,
    userId,
    startDate: inicio,
    endDate: fin,
    note,
  });

  res.status(201).json({ reservation });
}

module.exports = { listForCalendar, create };
