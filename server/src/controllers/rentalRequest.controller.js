// Modulo entero (no destructuring) para poder mockearlo en los tests.
const rentalRequestService = require('../services/rentalRequest.service');

async function list(req, res) {
  const { assetId } = req.query;
  // Falta, vacío o repetido (?assetId=a&assetId=b llega como array).
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
