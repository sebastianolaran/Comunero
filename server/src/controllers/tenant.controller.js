// Modulo entero (no destructuring) para poder mockearlo en los tests.
const tenantService = require('../services/tenant.service');
const { todayInArgentina } = require('../validation/newRentalRequest');
const { parseFechaISO } = require('../lib/fecha');

const MAX_SEARCH_LENGTH = 100;
const MAX_COMMENT_LENGTH = 1000;
const RATINGS = ['RECOMMENDED', 'NOT_RECOMMENDED', null];

const WRITE_ERRORS = {
  NOT_FOUND: [404, 'No existe el inquilino'],
  NOT_COOWNER: [403, 'Solo los copropietarios del bien pueden evaluar al inquilino'],
};

function isFilled(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function today() {
  return parseFechaISO(todayInArgentina());
}

async function list(req, res) {
  const { assetId, q = '' } = req.query;
  if (!isAssetId(assetId)) {
    return res.status(400).json({ error: 'Falta el parametro assetId' });
  }
  if (typeof q !== 'string' || q.length > MAX_SEARCH_LENGTH) {
    return res.status(400).json({ error: 'La busqueda no es valida' });
  }

  try {
    const tenants = await tenantService.listFinished(assetId, q, today());
    if (tenants === null) {
      return res.status(404).json({ error: 'No existe el bien' });
    }
    res.json(tenants);
  } catch (err) {
    console.error('tenants: fallo la consulta del historial de inquilinos', err);
    res.status(500).json({ error: 'No se pudo obtener el historial de inquilinos' });
  }
}

function isAssetId(assetId) {
  // Falta, vacío o repetido (?assetId=a&assetId=b llega como array).
  return typeof assetId === 'string' && assetId.trim() !== '';
}

async function detail(req, res) {
  const { assetId } = req.query;
  if (!isAssetId(assetId)) return res.status(400).json({ error: 'Falta el parametro assetId' });

  try {
    const tenant = await tenantService.getDetail(req.params.id, assetId, today());
    if (tenant === null) return res.status(404).json({ error: 'No existe el inquilino' });
    res.json(tenant);
  } catch (err) {
    console.error('tenants: fallo la consulta del inquilino', err);
    res.status(500).json({ error: 'No se pudo obtener el inquilino' });
  }
}

function sendWriteError(res, error) {
  const [status, message] = WRITE_ERRORS[error];
  return res.status(status).json({ error: message });
}

// TODO: el userId tiene que salir de la sesion cuando exista el login.
async function rate(req, res) {
  const { userId, rating } = req.body ?? {};
  if (!isFilled(userId)) return res.status(400).json({ error: 'Falta el copropietario que clasifica' });
  if (!RATINGS.includes(rating)) {
    return res.status(400).json({ error: 'La clasificación tiene que ser RECOMMENDED, NOT_RECOMMENDED o null' });
  }

  try {
    const result = await tenantService.setRating({ renterId: req.params.id, userId, rating });
    if (result.error) return sendWriteError(res, result.error);
    res.json(result.tenant);
  } catch (err) {
    console.error('tenants: fallo el cambio de clasificacion', err);
    res.status(500).json({ error: 'No se pudo guardar la clasificación' });
  }
}

async function comment(req, res) {
  const { userId, text } = req.body ?? {};
  if (!isFilled(userId)) return res.status(400).json({ error: 'Falta el copropietario que escribe' });
  if (!isFilled(text)) return res.status(400).json({ error: 'La observación no puede estar vacía' });
  const trimmed = text.trim();
  if (trimmed.length > MAX_COMMENT_LENGTH) {
    return res.status(400).json({ error: `La observación no puede superar los ${MAX_COMMENT_LENGTH} caracteres` });
  }

  try {
    const result = await tenantService.addComment({ renterId: req.params.id, userId, text: trimmed });
    if (result.error) return sendWriteError(res, result.error);
    res.status(201).json(result.comment);
  } catch (err) {
    console.error('tenants: fallo el alta de la observacion', err);
    res.status(500).json({ error: 'No se pudo guardar la observación' });
  }
}

module.exports = { list, detail, rate, comment };
