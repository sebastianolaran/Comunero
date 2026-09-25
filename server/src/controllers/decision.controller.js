// Modulo entero (no destructuring) para poder mockearlo en los tests.
const decisionService = require('../services/decision.service');
const { parseNewDecision } = require('../validation/newDecision');

const LIST_STATUSES = ['OPEN', ...decisionService.CLOSED_STATUSES];
const VOTE_VALUES = ['YES', 'NO'];
const MAX_ID_LENGTH = 64;

function isFilled(value) {
  return typeof value === 'string' && value.trim() !== '' && value.length <= MAX_ID_LENGTH;
}

// GET /api/decisions?assetId=...&status=OPEN|APPROVED|REJECTED
async function list(req, res) {
  const { assetId, status, userId } = req.query;
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
        ? await decisionService.listOpen(assetId, isFilled(userId) ? userId : undefined)
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

const VOTE_ERRORS = {
  NOT_FOUND: [404, 'No existe la propuesta'],
  NOT_COOWNER: [403, 'Solo los copropietarios del bien pueden votar'],
  CLOSED: [409, 'Esta propuesta ya se cerró'],
};

function parseVote(body) {
  const { userId, value } = body !== null && typeof body === 'object' ? body : {};
  // TODO: el userId tiene que salir de la sesion cuando exista el login.
  if (!isFilled(userId)) return { error: 'Falta el copropietario que vota' };
  if (!VOTE_VALUES.includes(value)) return { error: 'El voto tiene que ser YES o NO' };
  return { vote: { userId, value } };
}

// POST /api/decisions/:id/votes
async function vote(req, res) {
  if (!isFilled(req.params.id)) return res.status(404).json({ error: VOTE_ERRORS.NOT_FOUND[1] });
  const parsed = parseVote(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  try {
    const result = await decisionService.vote({ decisionId: req.params.id, ...parsed.vote });
    if (result.error) {
      const [status, message] = VOTE_ERRORS[result.error];
      return res.status(status).json({ error: message });
    }
    res.status(201).json(result.decision);
  } catch (err) {
    console.error('decisions: fallo el voto', err);
    res.status(500).json({ error: 'No se pudo registrar el voto' });
  }
}

module.exports = { list, create, vote };
