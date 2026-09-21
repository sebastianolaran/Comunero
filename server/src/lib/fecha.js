const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Parsea una fecha 'YYYY-MM-DD' a Date UTC medianoche. Devuelve null si el
// formato es invalido o falta. Se usa en cualquier endpoint que reciba
// fechas de reserva, para que todos comparen de la misma forma (UTC, sin
// hora), evitando corrimientos de un dia por huso horario.
function parseFechaISO(valor) {
  if (!valor || !DATE_RE.test(valor)) return null;
  const fecha = new Date(`${valor}T00:00:00.000Z`);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

// Cantidad de dias entre dos fechas UTC medianoche, inclusive en ambas
// puntas (20/12 al 22/12 = 3 dias).
function cantidadDias(inicio, fin) {
  const unDia = 24 * 60 * 60 * 1000;
  return Math.round((fin.getTime() - inicio.getTime()) / unDia) + 1;
}

module.exports = { parseFechaISO, cantidadDias };
