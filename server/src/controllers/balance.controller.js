// Modulo entero (no destructuring) para poder mockearlo en los tests.
const balanceService = require('../services/balance.service');
const { HttpError } = require('../lib/httpError');

function isFilled(value) {
  return typeof value === 'string' && value.trim() !== '';
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
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    console.error('balances: fallo el pedido', err);
    res.status(500).json({ error: 'No se pudo completar el pedido' });
  }
}

module.exports = { get };
