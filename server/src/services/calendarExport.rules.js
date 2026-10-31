// Exportar a .ics (iCalendar, RFC 5545) las reservas aprobadas, para
// importarlas a mano en Google Calendar. Funciones puras: sin base de datos.
//
// Solo van el título y las fechas: ni teléfono del inquilino, ni monto, ni
// nota. Una vez importado, el evento queda fuera de la app.

// mine = mis turnos de uso propio; use = los de todos; all = uso propio y alquileres.
const ALCANCES = ['mine', 'use', 'all'];

// Filtro de Prisma que se suma al de "aprobadas de hoy en adelante".
function filtroDeAlcance(scope, userId) {
  if (scope === 'mine') return { type: 'USE', userId };
  if (scope === 'use') return { type: 'USE' };
  return {};
}

// El nombre del bien va adelante para distinguir los eventos cuando se
// exporten varios bienes al mismo calendario.
function tituloEvento(reserva) {
  const bien = `[${reserva.asset.name}]`;
  if (reserva.type === 'RENTAL') {
    return reserva.renter?.name ? `${bien} Alquiler – ${reserva.renter.name}` : `${bien} Alquiler`;
  }
  return `${bien} Uso propio – ${reserva.user.name}`;
}

// Las fechas de reserva son medianoche UTC: se lee el día en UTC para que no
// se corra uno para atrás en Argentina.
function fechaIcs(fecha) {
  return fecha.toISOString().slice(0, 10).replace(/-/g, '');
}

function instanteIcs(fecha) {
  return `${fecha.toISOString().slice(0, 19).replace(/[-:]/g, '')}Z`;
}

function diaSiguiente(fecha) {
  return new Date(fecha.getTime() + 24 * 60 * 60 * 1000);
}

function escapar(texto) {
  return texto.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

// Las líneas no pueden pasar de 75 bytes: se cortan y la continuación arranca
// con un espacio. Se corta por caracter para no partir una letra con tilde.
function plegar(linea) {
  const partes = [];
  let actual = '';
  for (const caracter of linea) {
    const limite = partes.length === 0 ? 75 : 74;
    if (Buffer.byteLength(actual + caracter, 'utf8') > limite) {
      partes.push(actual);
      actual = '';
    }
    actual += caracter;
  }
  partes.push(actual);
  return partes.join('\r\n ');
}

// endDate es el último día ocupado (inclusive) y DTEND de un evento de día
// completo es exclusivo: va un día después.
function evento(reserva, generadoEn) {
  return [
    'BEGIN:VEVENT',
    `UID:${reserva.id}@comunero`,
    `DTSTAMP:${instanteIcs(generadoEn)}`,
    `DTSTART;VALUE=DATE:${fechaIcs(reserva.startDate)}`,
    `DTEND;VALUE=DATE:${fechaIcs(diaSiguiente(reserva.endDate))}`,
    `SUMMARY:${escapar(tituloEvento(reserva))}`,
    'END:VEVENT',
  ];
}

function armarIcs(reservas, { generadoEn = new Date() } = {}) {
  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Comunero//Exportar calendario//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...reservas.flatMap((reserva) => evento(reserva, generadoEn)),
    'END:VCALENDAR',
  ];
  return `${lineas.map(plegar).join('\r\n')}\r\n`;
}

// comunero-<bien>.ics, en ASCII para que el header Content-Disposition no
// tenga que codificar nada.
function nombreArchivo(nombreBien) {
  const slug = (nombreBien ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug ? `comunero-${slug}.ics` : 'comunero.ics';
}

module.exports = { ALCANCES, filtroDeAlcance, tituloEvento, armarIcs, nombreArchivo };
