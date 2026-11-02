// Modulo entero (no destructuring) para poder mockearlo en los tests.
const calendarExport = require('../services/calendarExport.service');
const { ALCANCES, armarIcs, nombreArchivo } = require('../services/calendarExport.rules');
const { HttpError } = require('../lib/httpError');
const { parseFechaISO } = require('../lib/fecha');
const { todayInArgentina } = require('../validation/newRentalRequest');

function isFilled(value) {
  return typeof value === 'string' && value.trim() !== '';
}

// GET /api/calendar/export.ics?userId&assetId&scope=mine|use|all
//
// Descarga un .ics con las reservas aprobadas de hoy en adelante, para
// importarlo a mano en Google Calendar. Hoy assetId es obligatorio; el
// service ya recibe una lista para cuando se exporten todos los bienes.
// TODO: cuando exista el login, userId tiene que salir de la sesion.
async function exportIcs(req, res) {
  const { userId, assetId, scope } = req.query;
  if (!isFilled(userId)) return res.status(400).json({ error: 'Falta el parametro userId' });
  if (!isFilled(assetId)) return res.status(400).json({ error: 'Falta el parametro assetId' });
  if (!ALCANCES.includes(scope)) {
    return res.status(400).json({ error: `El parametro scope tiene que ser ${ALCANCES.join(', ')}` });
  }

  try {
    const { assets, reservas } = await calendarExport.listarParaExportar({
      userId,
      assetIds: [assetId],
      scope,
      desde: parseFechaISO(todayInArgentina()),
    });

    res.set('Content-Type', 'text/calendar; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="${nombreArchivo(assets.length === 1 ? assets[0].name : null)}"`);
    // El client está en otro origen: sin esto, fetch no puede leer el nombre del archivo.
    res.set('Access-Control-Expose-Headers', 'Content-Disposition');
    res.send(armarIcs(reservas));
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    console.error('calendar: fallo la exportacion', err);
    res.status(500).json({ error: 'No se pudo exportar el calendario' });
  }
}

module.exports = { exportIcs };
