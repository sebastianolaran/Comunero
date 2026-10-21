// Modulo entero (no destructuring) para poder mockearlo en los tests.
const assetService = require('../services/asset.service');
const { parseName } = require('../services/asset.rules');

const MAX_ID_LENGTH = 64;

const ERRORS = {
  USER_NOT_FOUND: [404, 'No existe el usuario'],
  CODE_NOT_FOUND: [404, 'Ese código no corresponde a ningún bien'],
};

function isId(value) {
  return typeof value === 'string' && value.trim() !== '' && value.length <= MAX_ID_LENGTH;
}

function sendError(res, error) {
  const [status, message] = ERRORS[error];
  return res.status(status).json({ error: message });
}

// GET /api/assets?userId=...
async function list(req, res) {
  const { userId } = req.query;
  if (!isId(userId)) return res.status(400).json({ error: 'Falta el parametro userId' });

  try {
    const assets = await assetService.listForUser(userId);
    if (assets === null) return sendError(res, 'USER_NOT_FOUND');
    res.json({ assets });
  } catch (err) {
    // El detalle (puede incluir la connection string) va al log, no a la respuesta.
    console.error('assets: fallo la consulta de bienes', err);
    res.status(500).json({ error: 'No se pudieron obtener tus bienes' });
  }
}

// POST /api/assets { userId, name }
async function create(req, res) {
  const { userId, name } = req.body ?? {};
  if (!isId(userId)) return res.status(400).json({ error: 'Falta el usuario que crea el bien' });
  const parsed = parseName(name);
  if (parsed.error) return res.status(400).json({ error: parsed.error, field: 'name' });

  try {
    const result = await assetService.create({ userId, name: parsed.value });
    if (result.error) return sendError(res, result.error);
    res.status(201).json({ asset: result.asset });
  } catch (err) {
    console.error('assets: fallo el alta del bien', err);
    res.status(500).json({ error: 'No se pudo crear el bien' });
  }
}

// POST /api/assets/join { userId, code } -> 201, o 200 si ya era copropietario.
async function join(req, res) {
  const { userId, code } = req.body ?? {};
  if (!isId(userId)) return res.status(400).json({ error: 'Falta el usuario que se suma' });
  if (typeof code !== 'string' || code.trim() === '') {
    return res.status(400).json({ error: 'Falta el código del bien', field: 'code' });
  }

  try {
    const result = await assetService.join({ userId, code });
    if (result.error) return sendError(res, result.error);
    res.status(result.alreadyMember ? 200 : 201).json(result);
  } catch (err) {
    console.error('assets: fallo el alta como copropietario', err);
    res.status(500).json({ error: 'No pudimos sumarte al bien. Probá de nuevo en un momento.' });
  }
}

module.exports = { list, create, join };
