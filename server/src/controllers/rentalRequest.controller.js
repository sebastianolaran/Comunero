// Se usa el modulo entero (y no un destructuring) para poder mockear el
// service en los tests.
const rentalRequestService = require('../services/rentalRequest.service');

// GET /api/rental-requests?assetId= -> solicitudes del bien con su estado.
async function list(req, res) {
  const { assetId } = req.query;
  if (typeof assetId !== 'string' || assetId.trim() === '') {
    return res.status(400).json({ error: 'Falta el parametro assetId' });
  }

  try {
    const requests = await rentalRequestService.listByAsset(assetId);
    if (requests === null) {
      return res.status(404).json({ error: 'No existe el bien' });
    }
    res.json(requests);
  } catch (err) {
    console.error('rental-requests: fallo la consulta de solicitudes', err);
    res.status(500).json({ error: 'No se pudieron obtener las solicitudes' });
  }
}

module.exports = { list };
