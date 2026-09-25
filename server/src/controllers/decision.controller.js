// Modulo entero (no destructuring) para poder mockearlo en los tests.
const decisionService = require('../services/decision.service');

// GET /api/decisions?assetId=...&status=APPROVED|REJECTED
async function list(req, res) {
  const { assetId, status } = req.query;
  // Falta, vacío o repetido (?assetId=a&assetId=b llega como array).
  if (typeof assetId !== 'string' || assetId.trim() === '') {
    return res.status(400).json({ error: 'Falta el parametro assetId' });
  }
  if (status !== undefined && !decisionService.CLOSED_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'El parametro status tiene que ser APPROVED o REJECTED' });
  }

  try {
    const decisions = await decisionService.listClosed(assetId, { status });
    if (decisions === null) {
      return res.status(404).json({ error: 'No existe el bien' });
    }
    res.json({ decisions });
  } catch (err) {
    // El detalle (puede incluir la connection string) va al log, no a la respuesta.
    console.error('decisions: fallo la consulta del historial de decisiones', err);
    res.status(500).json({ error: 'No se pudo obtener el historial de decisiones' });
  }
}

module.exports = { list };
