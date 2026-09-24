// Casos de uso de Balance. Recibe viewer = { assetId, userId }: el bien y
// quien mira, que es desde donde se calcula quien le debe a quien.
// TODO: cuando exista el login, viewer tiene que salir de la sesion.

const repo = require('./balance.repo');
const rules = require('./balance.rules');
// Modulo entero (no destructuring) para poder mockearlo en los tests.
const movementService = require('./movement.service');
const { forbidden, notFound } = require('../lib/httpError');

// { net, coowners }: el balance con cada uno de los demas copropietarios del
// bien, con su detalle, y el neto. Falla si el bien no existe o si quien pide
// no es copropietario.
async function getBalances({ assetId, userId }) {
  if (!(await repo.assetExists(assetId))) throw notFound('No existe el bien');
  const coowners = await repo.listCoowners(assetId);
  if (!coowners.some((coowner) => coowner.id === userId)) {
    throw forbidden('Solo los copropietarios del bien pueden ver su balance');
  }

  // Igual que al abrir Movimientos: sin esto, un recurrente del mes podria no
  // estar generado todavia y faltaria en el balance hasta la pasada horaria.
  await movementService.generateDueRecurrences(assetId);
  const [movements, settlements] = await Promise.all([
    repo.findMovementsOf(assetId, userId),
    repo.findSettlementsOf(assetId, userId),
  ]);
  return rules.buildBalances(userId, coowners, movements, settlements);
}

module.exports = { getBalances };
