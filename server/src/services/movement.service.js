// Casos de uso de Movimientos. Cualquier copropietario del bien puede ver,
// crear, editar y borrar cualquier movimiento del bien.
//
// Cada caso de uso recibe viewer = { assetId, userId }: el bien y quien usa
// la app. userId define "cuanto te toca" en cada movimiento.
// TODO: cuando exista el login, viewer tiene que salir de la sesion.

const repo = require('./movement.repo');
const rules = require('./movement.rules');
const { badRequest, forbidden, notFound } = require('../lib/httpError');

// Tope de meses que se ponen al dia en una sola pasada (una cadena parada hace
// diez anios no deberia colgar el pedido).
const MAX_CATCH_UP_MONTHS = 120;

// Copropietarios del bien. Falla si el bien no existe o si quien pide no es
// uno de ellos.
async function coownersFor({ assetId, userId }) {
  if (!(await repo.assetExists(assetId))) throw notFound('No existe el bien');
  const coowners = await repo.listCoowners(assetId);
  if (!coowners.some((coowner) => coowner.id === userId)) {
    throw forbidden('Solo los copropietarios del bien pueden ver y cargar sus movimientos');
  }
  return coowners;
}

const idsOf = (coowners) => coowners.map((coowner) => coowner.id);

// Genera las copias de los recurrentes que ya corresponden: cada recurrente de
// un mes anterior al actual que todavia no se copio genera la del mes siguiente,
// fechada el 1. Se repite hasta ponerse al dia (si nadie entro durante un par
// de meses, se generan todas las que faltan) y nunca genera un mes futuro.
// Devuelve cuantas copias creo.
async function generateDueRecurrences(assetId, period = rules.currentPeriod()) {
  const before = rules.periodRange(period).gte;
  let created = 0;
  for (let round = 0; round < MAX_CATCH_UP_MONTHS; round += 1) {
    const pending = await repo.findPendingRecurrences(assetId, before);
    if (pending.length === 0) break;
    for (const source of pending) {
      const { input, built } = rules.buildRecurrenceCopy(source);
      if (await repo.cloneRecurrence(source.id, assetId, input, built)) created += 1;
    }
  }
  return created;
}

async function generateAllDueRecurrences() {
  for (const assetId of await repo.listAssetIds()) {
    await generateDueRecurrences(assetId);
  }
}

async function listCoowners(viewer) {
  return coownersFor(viewer);
}

async function listMovements(viewer, query = {}) {
  await coownersFor(viewer);
  const period = query.period ?? rules.currentPeriod();
  if (!rules.isValidPeriod(period)) throw badRequest('el período tiene que tener formato AAAA-MM');
  const { type } = query;
  if (type !== undefined && !rules.MOVEMENT_TYPES.includes(type)) {
    throw badRequest('el filtro de tipo tiene que ser EXPENSE o INCOME');
  }

  await generateDueRecurrences(viewer.assetId);
  const records = await repo.findMovementsInRange(viewer.assetId, rules.periodRange(period));
  const movements = records.map((record) => rules.serializeMovement(record, viewer.userId));

  return {
    period,
    summary: rules.summarizePeriod(movements),
    counts: rules.countByType(movements),
    movements: type ? movements.filter((movement) => movement.type === type) : movements,
  };
}

async function listPeriods(viewer) {
  await coownersFor(viewer);
  const current = rules.currentPeriod();
  await generateDueRecurrences(viewer.assetId, current);
  const periods = await repo.findDistinctPeriods(viewer.assetId);
  return { current, periods: rules.buildPeriodList(periods, current) };
}

async function getMovement(viewer, rawId) {
  await coownersFor(viewer);
  const record = await repo.findMovement(viewer.assetId, rules.parseId(rawId));
  if (!record) throw notFound('el movimiento no existe');
  return rules.serializeMovement(record, viewer.userId);
}

async function createMovement(viewer, body) {
  const coowners = await coownersFor(viewer);
  const input = rules.validateMovementInput(body, idsOf(coowners));
  const record = await repo.insertMovement(viewer.assetId, input, rules.buildShares(input));
  return rules.serializeMovement(record, viewer.userId);
}

// Mismas validaciones y reparto que el alta. Sacarle el tilde de recurrente
// corta la cadena (no se genera el mes siguiente); ponerselo la arranca desde
// este movimiento.
async function updateMovement(viewer, rawId, body) {
  const coowners = await coownersFor(viewer);
  const id = rules.parseId(rawId);
  if (!(await repo.findMovement(viewer.assetId, id))) throw notFound('el movimiento no existe');

  const input = rules.validateMovementInput(body, idsOf(coowners));
  const record = await repo.replaceMovement(id, input, rules.buildShares(input));
  if (!record) throw notFound('el movimiento no existe');
  return rules.serializeMovement(record, viewer.userId);
}

// Borrar la ultima copia de un recurrente corta la cadena: la anterior ya
// genero la suya, asi que nadie vuelve a generar el mes siguiente. Las de los
// meses anteriores quedan como estan.
async function deleteMovement(viewer, rawId) {
  await coownersFor(viewer);
  const removed = await repo.removeMovement(viewer.assetId, rules.parseId(rawId));
  if (removed === 0) throw notFound('el movimiento no existe');
}

module.exports = {
  generateDueRecurrences,
  generateAllDueRecurrences,
  listCoowners,
  listMovements,
  listPeriods,
  getMovement,
  createMovement,
  updateMovement,
  deleteMovement,
};
