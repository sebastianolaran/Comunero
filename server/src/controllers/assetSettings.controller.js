// Modulo entero (no destructuring) para poder mockearlo en los tests.
const settingsService = require('../services/assetSettings.service');

const MAX_ID_LENGTH = 64;

const ERRORS = {
  ASSET_NOT_FOUND: [404, 'No existe el bien'],
  NOT_COOWNER: [403, 'Solo los copropietarios del bien pueden ver y cambiar su configuración'],
};

function isId(value) {
  return typeof value === 'string' && value.trim() !== '' && value.length <= MAX_ID_LENGTH;
}

function sendResult(res, result) {
  if (result.error === 'INVALID') return res.status(400).json({ error: result.message, field: result.field });
  if (result.error) {
    const [status, message] = ERRORS[result.error];
    return res.status(status).json({ error: message });
  }
  return res.json({ settings: result.settings });
}

// GET /api/assets/:id/settings?userId=...
async function get(req, res) {
  const { userId } = req.query;
  if (!isId(userId)) return res.status(400).json({ error: 'Falta el parametro userId' });

  try {
    sendResult(res, await settingsService.getSettings({ assetId: req.params.id, userId }));
  } catch (err) {
    // El detalle (puede incluir la connection string) va al log, no a la respuesta.
    console.error('settings: fallo la consulta de la configuración', err);
    res.status(500).json({ error: 'No se pudo obtener la configuración' });
  }
}

// PATCH /api/assets/:id/settings { userId, ...lo que cambia }
async function update(req, res) {
  const body = req.body ?? {};
  if (!isId(body.userId)) return res.status(400).json({ error: 'Falta el usuario que cambia la configuración' });

  try {
    sendResult(res, await settingsService.updateSettings({ assetId: req.params.id, userId: body.userId, body }));
  } catch (err) {
    console.error('settings: fallo el cambio de configuración', err);
    res.status(500).json({ error: 'No se pudo guardar la configuración. Probá de nuevo en un momento.' });
  }
}

module.exports = { get, update };
