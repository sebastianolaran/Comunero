// Casos de uso de Movimientos. Cualquier copropietario del bien puede ver,
// crear, editar y borrar cualquier movimiento del bien.
//
// Cada caso de uso recibe viewer = { assetId, userId }: el bien y quien usa
// la app. userId define "cuanto te toca" en cada movimiento.
// TODO: cuando exista el login, viewer tiene que salir de la sesion.

const repo = require('./movement.repo');
const rules = require('./movement.rules');
const { badRequest, forbidden, notFound } = require('../lib/httpError');
// Modulo entero (no destructuring) para poder mockearlo en los tests.
const settingsService = require('./assetSettings.service');

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

// Con el color y el porcentaje de cada uno (null: partes iguales), para el
// reparto del modal.
async function listCoowners(viewer) {
  const coowners = await coownersFor(viewer);
  const [hues, percents] = await Promise.all([
    settingsService.huesOf(viewer.assetId),
    settingsService.percentsOf(viewer.assetId),
  ]);
  return coowners.map((coowner) => ({ ...coowner, hue: hues[coowner.id], percent: percents?.[coowner.id] ?? null }));
}

async function listMovements(viewer, query = {}) {
  await coownersFor(viewer);
  const period = query.period ?? rules.currentPeriod();
  if (!rules.isValidPeriod(period)) throw badRequest('el período tiene que tener formato AAAA-MM');
  const { type } = query;
  if (type !== undefined && !rules.MOVEMENT_TYPES.includes(type)) {
    throw badRequest('el filtro de tipo tiene que ser EXPENSE o INCOME');
  }

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
  const percents = await settingsService.percentsOf(viewer.assetId);
  const record = await repo.insertMovement(viewer.assetId, input, rules.buildShares(input, percents));
  return rules.serializeMovement(record, viewer.userId);
}

// Mismas validaciones y reparto que el alta, con los porcentajes de hoy.
async function updateMovement(viewer, rawId, body) {
  const coowners = await coownersFor(viewer);
  const id = rules.parseId(rawId);
  if (!(await repo.findMovement(viewer.assetId, id))) throw notFound('el movimiento no existe');

  const input = rules.validateMovementInput(body, idsOf(coowners));
  const percents = await settingsService.percentsOf(viewer.assetId);
  const record = await repo.replaceMovement(id, input, rules.buildShares(input, percents));
  if (!record) throw notFound('el movimiento no existe');
  return rules.serializeMovement(record, viewer.userId);
}

async function deleteMovement(viewer, rawId) {
  await coownersFor(viewer);
  const removed = await repo.removeMovement(viewer.assetId, rules.parseId(rawId));
  if (removed === 0) throw notFound('el movimiento no existe');
}

module.exports = {
  listCoowners,
  listMovements,
  listPeriods,
  getMovement,
  createMovement,
  updateMovement,
  deleteMovement,
};
