// Modulo entero (no destructuring) para poder mockearlo en los tests.
const decisionService = require('../services/decision.service');
const { parseNewDecision } = require('../validation/newDecision');

const LIST_STATUSES = ['OPEN', ...decisionService.CLOSED_STATUSES];

// GET /api/decisions?assetId=...&status=OPEN|APPROVED|REJECTED
async function list(req, res) {
  const { assetId, status } = req.query;
  // Falta, vacío o repetido (?assetId=a&assetId=b llega como array).
  if (typeof assetId !== 'string' || assetId.trim() === '') {
    return res.status(400).json({ error: 'Falta el parametro assetId' });
  }
  if (status !== undefined && !LIST_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'El parametro status tiene que ser OPEN, APPROVED o REJECTED' });
  }

  try {
    // Sin status sigue trayendo solo el historial (aprobadas y rechazadas).
    const decisions =
      status === 'OPEN'
        ? await decisionService.listOpen(assetId)
        : await decisionService.listClosed(assetId, { status });
    if (decisions === null) {
      return res.status(404).json({ error: 'No existe el bien' });
    }
    res.json({ decisions });
  } catch (err) {
    // El detalle (puede incluir la connection string) va al log, no a la respuesta.
    console.error('decisions: fallo la consulta de decisiones', err);
    res.status(500).json({ error: 'No se pudieron obtener las decisiones' });
  }
}

const CREATE_ERRORS = {
  ASSET_NOT_FOUND: [404, 'No existe el bien'],
  NOT_COOWNER: [403, 'Solo los copropietarios del bien pueden proponer decisiones'],
};

// POST /api/decisions
async function create(req, res) {
  const parsed = parseNewDecision(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error, field: parsed.field });

  try {
    const result = await decisionService.create(parsed.decision);
    if (result.error) {
      const [status, message] = CREATE_ERRORS[result.error];
      return res.status(status).json({ error: message });
    }
    res.status(201).json(result.decision);
  } catch (err) {
    console.error('decisions: fallo el alta de la propuesta', err);
    res.status(500).json({ error: 'No se pudo crear la propuesta' });
  }
}

module.exports = { list, create };
