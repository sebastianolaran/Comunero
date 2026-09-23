// Modulo entero (no destructuring) para poder mockearlo en los tests.
const tenantService = require('../services/tenant.service');
const { todayInArgentina } = require('../validation/newRentalRequest');
const { parseFechaISO } = require('../lib/fecha');

const MAX_SEARCH_LENGTH = 100;

async function list(req, res) {
  const { assetId, q = '' } = req.query;
  // Falta, vacío o repetido (?assetId=a&assetId=b llega como array).
  if (typeof assetId !== 'string' || assetId.trim() === '') {
    return res.status(400).json({ error: 'Falta el parametro assetId' });
  }
  if (typeof q !== 'string' || q.length > MAX_SEARCH_LENGTH) {
    return res.status(400).json({ error: 'La busqueda no es valida' });
  }

  try {
    const tenants = await tenantService.listFinished(assetId, q, parseFechaISO(todayInArgentina()));
    if (tenants === null) {
      return res.status(404).json({ error: 'No existe el bien' });
    }
    res.json(tenants);
  } catch (err) {
    console.error('tenants: fallo la consulta del historial de inquilinos', err);
    res.status(500).json({ error: 'No se pudo obtener el historial de inquilinos' });
  }
}

module.exports = { list };
