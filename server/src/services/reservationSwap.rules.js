const { cantidadDias } = require('../lib/fecha');

function swappable(reservation, assetId) {
  return Boolean(reservation) && reservation.type === 'USE' && reservation.status === 'ACTIVE' && reservation.assetId === assetId;
}

// null si userId puede pedir este turno a cambio de uno suyo.
function requestedProblem({ requested, userId, today }) {
  if (!swappable(requested, requested?.assetId)) return 'NOT_SWAPPABLE';
  if (requested.userId === userId) return 'SAME_USER';
  if (requested.startDate <= today) return 'STARTED';
  return null;
}

// null si el par se puede intercambiar; si no, el primer motivo que lo impide.
// Se vuelve a chequear al aceptar: entre la propuesta y la respuesta un turno
// puede haberse cancelado o empezado.
function swapProblem({ offered, requested, proposerId, today }) {
  if (!swappable(offered, offered?.assetId) || !swappable(requested, offered.assetId)) return 'NOT_SWAPPABLE';
  if (offered.userId !== proposerId) return 'NOT_OWNER';
  if (offered.startDate <= today) return 'STARTED';
  const problem = requestedProblem({ requested, userId: proposerId, today });
  if (problem) return problem;
  if (cantidadDias(offered.startDate, offered.endDate) !== cantidadDias(requested.startDate, requested.endDate)) {
    return 'DAYS_MISMATCH';
  }
  return null;
}

module.exports = { swapProblem, requestedProblem };
