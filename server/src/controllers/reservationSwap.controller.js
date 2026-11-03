const swapService = require('../services/reservationSwap.service');
const { parseFechaISO } = require('../lib/fecha');
const { todayInArgentina } = require('../validation/newRentalRequest');

const ERRORS = {
  NOT_FOUND: [404, 'No existe el turno o el intercambio'],
  NOT_OWNER: [403, 'Solo se pueden ofrecer turnos propios'],
  NOT_RECIPIENT: [403, 'Solo quien recibió la propuesta puede responderla'],
  NOT_PROPOSER: [403, 'Solo quien propuso el intercambio puede retirarlo'],
  SAME_USER: [409, 'No se puede intercambiar un turno con uno propio'],
  NOT_SWAPPABLE: [409, 'Solo se intercambian turnos de uso propio aprobados del mismo bien'],
  STARTED: [409, 'Solo se intercambian turnos que todavía no empezaron'],
  DAYS_MISMATCH: [409, 'Los dos turnos tienen que tener la misma cantidad de días'],
  BUSY: [409, 'Uno de los turnos ya tiene un intercambio pendiente'],
  RESOLVED: [409, 'El intercambio ya estaba resuelto'],
};

function texto(valor) {
  return typeof valor === 'string' && valor.trim() !== '';
}

function hoy() {
  return parseFechaISO(todayInArgentina());
}

// Envuelve cada handler: un service que falla responde 500 con { error } en vez de colgar.
function handler(nombre, fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      console.error(`reservation-swaps: falló ${nombre}`, err);
      res.status(500).json({ error: 'No se pudo completar la operación del intercambio' });
    }
  };
}

function responderError(res, result) {
  if (result.error === 'STALE') {
    return res.status(409).json({ error: `El intercambio quedó sin efecto: ${result.swap.closedReason}`, swap: result.swap });
  }
  const [status, error] = ERRORS[result.error] ?? [500, 'No se pudo completar la operación del intercambio'];
  return res.status(status).json({ error });
}

// GET /api/reservation-swaps?assetId=...&userId=...
const list = handler('list', async (req, res) => {
  const { assetId, userId } = req.query;
  if (!texto(assetId) || !texto(userId)) return res.status(400).json({ error: 'faltan assetId y/o userId' });

  const swaps = await swapService.list(assetId, userId);
  if (!swaps) return res.status(403).json({ error: 'no perteneces a este bien' });
  res.json({ swaps });
});

// GET /api/reservation-swaps/options?userId=...&requestedReservationId=...
const options = handler('options', async (req, res) => {
  const { userId, requestedReservationId } = req.query;
  if (!texto(userId) || !texto(requestedReservationId)) {
    return res.status(400).json({ error: 'faltan userId y/o requestedReservationId' });
  }

  const result = await swapService.options({ userId, requestedReservationId, today: hoy() });
  if (result.error) return responderError(res, result);
  res.json({ reservations: result.reservations });
});

// POST /api/reservation-swaps  body: { userId, offeredReservationId, requestedReservationId }
const propose = handler('propose', async (req, res) => {
  const { userId, offeredReservationId, requestedReservationId } = req.body ?? {};
  if (![userId, offeredReservationId, requestedReservationId].every(texto)) {
    return res.status(400).json({ error: 'faltan userId, offeredReservationId y/o requestedReservationId' });
  }

  const result = await swapService.propose({ userId, offeredReservationId, requestedReservationId, today: hoy() });
  if (result.error) return responderError(res, result);
  res.status(201).json({ swap: result.swap });
});

// POST /api/reservation-swaps/:id/response  body: { userId, value: 'ACCEPT' | 'REJECT' }
const respond = handler('respond', async (req, res) => {
  const { userId, value } = req.body ?? {};
  if (!texto(userId) || !['ACCEPT', 'REJECT'].includes(value)) {
    return res.status(400).json({ error: 'faltan userId y/o una respuesta válida' });
  }

  const result = await swapService.respond({ swapId: req.params.id, userId, value, today: hoy() });
  if (result.error) return responderError(res, result);
  res.json({ swap: result.swap });
});

// POST /api/reservation-swaps/:id/cancellation  body: { userId }
const cancel = handler('cancel', async (req, res) => {
  const { userId } = req.body ?? {};
  if (!texto(userId)) return res.status(400).json({ error: 'falta userId' });

  const result = await swapService.cancel({ swapId: req.params.id, userId });
  if (result.error) return responderError(res, result);
  res.json({ swap: result.swap });
});

module.exports = { list, options, propose, respond, cancel };
