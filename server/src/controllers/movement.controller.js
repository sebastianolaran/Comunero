// Modulo entero (no destructuring) para poder mockearlo en los tests.
const movementService = require('../services/movement.service');
const { HttpError } = require('../lib/httpError');

function isFilled(value) {
  return typeof value === 'string' && value.trim() !== '';
}

// assetId y userId llegan en la query (GET, DELETE) o en el body (POST, PUT).
// TODO: cuando exista el login, tienen que salir de la sesion y no del pedido.
function parseViewer(source = {}) {
  const { assetId, userId } = source;
  if (!isFilled(assetId)) return { error: 'Falta el parametro assetId' };
  if (!isFilled(userId)) return { error: 'Falta el parametro userId' };
  return { viewer: { assetId, userId } };
}

// Arma el handler de una ruta: valida quien pide, corre el caso de uso y
// responde. Los HttpError de las reglas salen como { error } con su status.
function handle(from, run, status = 200) {
  return async (req, res) => {
    const parsed = parseViewer(req[from]);
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    try {
      const result = await run(parsed.viewer, req);
      if (status === 204) return res.status(204).end();
      res.status(status).json(result);
    } catch (err) {
      if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
      console.error('movements: fallo el pedido', err);
      res.status(500).json({ error: 'No se pudo completar el pedido' });
    }
  };
}

// GET /api/movements/coowners?assetId&userId -> [{ id, name }]
const listCoowners = handle('query', (viewer) => movementService.listCoowners(viewer));

// GET /api/movements/periods?assetId&userId -> { current, periods }: meses con
// movimientos mas el actual, del mas nuevo al mas viejo.
const listPeriods = handle('query', (viewer) => movementService.listPeriods(viewer));

// GET /api/movements?assetId&userId&period=AAAA-MM&type=EXPENSE|INCOME
// -> { period, summary, counts, movements }. counts es del periodo entero,
// sin aplicar el filtro de tipo.
const list = handle('query', (viewer, req) =>
  movementService.listMovements(viewer, { period: req.query.period, type: req.query.type }),
);

const get = handle('query', (viewer, req) => movementService.getMovement(viewer, req.params.id));

const create = handle('body', (viewer, req) => movementService.createMovement(viewer, req.body), 201);

const update = handle('body', (viewer, req) =>
  movementService.updateMovement(viewer, req.params.id, req.body),
);

const remove = handle('query', (viewer, req) => movementService.deleteMovement(viewer, req.params.id), 204);

module.exports = { listCoowners, listPeriods, list, get, create, update, remove };
