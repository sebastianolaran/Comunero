// Utilidades puras para la HU "Consultar calendario".
// Todo se trabaja en UTC para evitar que un dia se corra por el huso
// horario del navegador (el server tambien arma los rangos en UTC).

// Regla: "muestra un unico mes a la vez" + "muestra todos los dias del mes
// seleccionado" (y no dias de otro mes).
export function diasDelMes(year, month) {
  const cantidadDias = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const dias = [];
  for (let dia = 1; dia <= cantidadDias; dia++) {
    dias.push(new Date(Date.UTC(year, month - 1, dia)));
  }
  return dias;
}

// Regla: "se puede navegar al mes anterior y posterior".
export function mesSiguiente(year, month) {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

export function mesAnterior(year, month) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

export function nombreMes(year, month) {
  const formatter = new Intl.DateTimeFormat('es-AR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return formatter.format(new Date(Date.UTC(year, month - 1, 1)));
}

function fechaUTC(valor) {
  const d = new Date(valor);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function cubreElDia(reserva, dia) {
  const diaUTC = fechaUTC(dia);
  return diaUTC >= fechaUTC(reserva.startDate) && diaUTC <= fechaUTC(reserva.endDate);
}

// Regla: "cada dia debe mostrar su estado: libre, reservado a un
// integrante, alquilado a un tercero, o rechazado, mediante un color o
// estilo distintivo".
//
// Si hay mas de una reserva sobre el mismo dia, una vigente (ACTIVE o
// PENDING) tiene prioridad sobre una rechazada. Las canceladas ya vienen
// filtradas por el backend, pero se ignoran igual por si acaso.
export function estadoDelDia(dia, reservas) {
  const delDia = reservas.filter((r) => r.status !== 'CANCELLED' && cubreElDia(r, dia));

  if (delDia.length === 0) {
    return { estado: 'libre' };
  }

  const vigente = delDia.find((r) => r.status === 'ACTIVE' || r.status === 'PENDING');
  if (vigente) {
    return vigente.type === 'RENTAL'
      ? { estado: 'alquilado', reservationId: vigente.id, renterId: vigente.renterId }
      : { estado: 'reservado', reservationId: vigente.id, userId: vigente.userId };
  }

  const rechazada = delDia.find((r) => r.status === 'REJECTED');
  return { estado: 'rechazado', reservationId: rechazada.id, userId: rechazada.userId };
}

// Color deterministico por integrante (mismo userId -> mismo color
// siempre), mientras no exista un campo "color" persistido en User.
// TODO: reemplazar por el color real cuando el schema lo tenga.
const PALETA_INTEGRANTES = ['#2f9e44', '#1c7ed6', '#e8590c', '#9c36b5', '#e64980', '#0ca678'];

export function colorDeIntegrante(userId) {
  if (!userId) return PALETA_INTEGRANTES[0];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return PALETA_INTEGRANTES[hash % PALETA_INTEGRANTES.length];
}
