// Modulo entero (no destructuring) para poder mockearlo en los tests.
const rentalRequestService = require('../services/rentalRequest.service');
const { parseNewRequest } = require('../validation/newRentalRequest');

const VOTE_VALUES = ['APPROVE', 'REJECT'];
const MAX_REASON_LENGTH = 500;

const VOTE_ERRORS = {
  NOT_FOUND: [404, 'No existe la solicitud de alquiler'],
  NOT_COOWNER: [403, 'Solo los copropietarios del bien pueden votar'],
  RESOLVED: [409, 'La solicitud ya fue resuelta: no se puede votar de nuevo'],
};

function isFilled(value) {
  return typeof value === 'string' && value.trim() !== '';
}

async function list(req, res) {
  const { assetId, userId } = req.query;
  // Falta, vacío o repetido (?assetId=a&assetId=b llega como array).
  if (typeof assetId !== 'string' || assetId.trim() === '') {
    return res.status(400).json({ error: 'Falta el parametro assetId' });
  }

  try {
    const requests = await rentalRequestService.listByAsset(
      assetId,
      isFilled(userId) ? userId : undefined,
    );
    if (requests === null) {
      return res.status(404).json({ error: 'No existe el bien' });
    }
    res.json(requests);
  } catch (err) {
    console.error('rental-requests: fallo la consulta de solicitudes', err);
    res.status(500).json({ error: 'No se pudieron obtener las solicitudes' });
  }
}

function parseVote(body = {}) {
  const { userId, value, reason } = body;
  // TODO: el userId tiene que salir de la sesion cuando exista el login.
  if (!isFilled(userId)) return { error: 'Falta el copropietario que vota' };
  if (!VOTE_VALUES.includes(value)) return { error: 'El voto tiene que ser APPROVE o REJECT' };
  if (value === 'APPROVE') return { vote: { userId, value, reason: null } };

  if (!isFilled(reason)) return { error: 'Para votar que no tenes que cargar el motivo' };
  const trimmed = reason.trim();
  if (trimmed.length > MAX_REASON_LENGTH) {
    return { error: `El motivo no puede superar los ${MAX_REASON_LENGTH} caracteres` };
  }
  return { vote: { userId, value, reason: trimmed } };
}

async function vote(req, res) {
  const parsed = parseVote(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  try {
    const result = await rentalRequestService.vote({ reservationId: req.params.id, ...parsed.vote });
    if (result.error) {
      const [status, message] = VOTE_ERRORS[result.error];
      return res.status(status).json({ error: message });
    }
    res.status(201).json(result.request);
  } catch (err) {
    console.error('rental-requests: fallo el voto', err);
    res.status(500).json({ error: 'No se pudo registrar el voto' });
  }
}

const CREATE_ERRORS = {
  ASSET_NOT_FOUND: [404, 'No existe el bien'],
  NOT_COOWNER: [403, 'Solo los copropietarios del bien pueden cargar solicitudes'],
};

async function create(req, res) {
  const parsed = parseNewRequest(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error, field: parsed.field });

  try {
    const result = await rentalRequestService.create(parsed.request);
    if (result.error) {
      const [status, message] = CREATE_ERRORS[result.error];
      return res.status(status).json({ error: message });
    }
    res.status(201).json(result.request);
  } catch (err) {
    console.error('rental-requests: fallo el alta de la solicitud', err);
    res.status(500).json({ error: 'No se pudo crear la solicitud' });
  }
}

const PAYMENT_ERRORS = {
  NOT_FOUND: [404, 'No existe la solicitud de alquiler'],
  NOT_COOWNER: [403, 'Solo los copropietarios del bien pueden marcar el pago'],
  NOT_APPROVED: [409, 'Solo se puede marcar el pago de un alquiler aprobado'],
  ALREADY_PAID: [409, 'El alquiler ya estaba marcado como pago'],
  NO_AMOUNT: [409, 'El alquiler no tiene monto cargado: no se puede registrar el ingreso'],
};

async function markPaid(req, res) {
  // TODO: el userId tiene que salir de la sesion cuando exista el login.
  const { userId } = req.body ?? {};
  if (!isFilled(userId)) return res.status(400).json({ error: 'Falta el copropietario que marca el pago' });

  try {
    const result = await rentalRequestService.markPaid({ reservationId: req.params.id, userId });
    if (result.error) {
      const [status, message] = PAYMENT_ERRORS[result.error];
      return res.status(status).json({ error: message });
    }
    res.json(result.request);
  } catch (err) {
    console.error('rental-requests: fallo el registro del pago', err);
    res.status(500).json({ error: 'No se pudo marcar el pago' });
  }
}

module.exports = { list, vote, create, markPaid };
