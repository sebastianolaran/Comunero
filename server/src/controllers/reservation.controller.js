const reservationService = require('../services/reservation.service');

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

module.exports = { listForCalendar };
