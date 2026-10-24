// Reglas de votacion de reservas que no tocan la base: cuantos votos a favor
// hacen falta y en que estado queda la reserva. Viven aparte de Prisma para
// testearlas sin base.

// Votos a favor necesarios para aprobar una reserva de este tipo (USE o RENTAL).
// Por ahora todo se aprueba por unanimidad. Cuando exista la pantalla de
// configuracion del bien, el minimo de cada tipo se lee de ahi (pueden ser
// distintos); este es el unico lugar que hay que cambiar.
function requiredApprovals(_type, coownerCount) {
  return coownerCount;
}

// Se aprueba al llegar al minimo y se rechaza apenas ya no se puede llegar
// (con unanimidad, un solo "no" alcanza). Mientras tanto, sigue pendiente.
function votingStatus({ approvals, objections, coownerCount, required }) {
  if (required > 0 && approvals >= required) return 'ACTIVE';

  const pending = coownerCount - approvals - objections;
  if (approvals + pending < required) return 'REJECTED';
  return 'PENDING';
}

const EXPIRED_REASON = 'Venció el plazo para responder';
const MS_PER_HOUR = 60 * 60 * 1000;

// Una pendiente creada antes de este momento ya venció; null si el bien no
// tiene tiempo para responder.
function expiryLimit(responseHours, now) {
  return responseHours == null ? null : new Date(now.getTime() - responseHours * MS_PER_HOUR);
}

// Qué pasa con una pendiente vencida: quien no votó cuenta según lo elegido en
// Configuración. Un No ya cargado la rechaza aunque el silencio cuente como Sí.
function expiredOutcome({ objections, action }) {
  if (objections > 0 || action !== 'APPROVE') return 'REJECTED';
  return 'ACTIVE';
}

module.exports = { requiredApprovals, votingStatus, EXPIRED_REASON, expiryLimit, expiredOutcome };
