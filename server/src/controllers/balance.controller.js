// Modulo entero (no destructuring) para poder mockearlo en los tests.
const balanceService = require('../services/balance.service');
const { HttpError } = require('../lib/httpError');

function isFilled(value) {
  return typeof value === 'string' && value.trim() !== '';
}

// Los HttpError salen con su status y sus details (ej: el monto actual en un
// 409); el resto, como 500 generico.
function sendError(res, err) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, ...err.details });
  console.error('balances: fallo el pedido', err);
  res.status(500).json({ error: 'No se pudo completar el pedido' });
}

// GET /api/balances?assetId&userId -> { net, coowners }. Ver balance.rules.js.
// TODO: cuando exista el login, assetId y userId tienen que salir de la sesion.
async function get(req, res) {
  const { assetId, userId } = req.query;
  if (!isFilled(assetId)) return res.status(400).json({ error: 'Falta el parametro assetId' });
  if (!isFilled(userId)) return res.status(400).json({ error: 'Falta el parametro userId' });

  try {
    res.json(await balanceService.getBalances({ assetId, userId }));
  } catch (err) {
    sendError(res, err);
  }
}

// POST /api/balances/close { assetId, fromUserId, toUserId, amount } -> 201
// con el saldo cerrado. Pago total de la deuda de fromUserId con toUserId;
// amount es el monto que se mostro en el modal.
// TODO: cuando exista el login, fromUserId (quien pide) tiene que salir de la
// sesion: hoy cualquiera puede mandarlo en nombre de otro.
async function close(req, res) {
  const { assetId, fromUserId, toUserId, amount } = req.body ?? {};
  if (!isFilled(assetId)) return res.status(400).json({ error: 'Falta el campo assetId' });
  if (!isFilled(fromUserId)) return res.status(400).json({ error: 'Falta el campo fromUserId' });
  if (!isFilled(toUserId)) return res.status(400).json({ error: 'Falta el campo toUserId' });
  if (!Number.isInteger(amount) || amount <= 0) {
    return res.status(400).json({ error: 'El monto tiene que ser un entero positivo' });
  }

  try {
    res.status(201).json(await balanceService.closeBalance({ assetId, fromUserId, toUserId, amount }));
  } catch (err) {
    sendError(res, err);
  }
}

module.exports = { get, close };
