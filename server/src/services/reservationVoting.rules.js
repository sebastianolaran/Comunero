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

module.exports = { requiredApprovals, votingStatus };
