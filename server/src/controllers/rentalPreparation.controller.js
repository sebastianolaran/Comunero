// Modulo entero (no destructuring) para poder mockearlo en los tests.
const rentalPreparationService = require('../services/rentalPreparation.service');

// GET /api/rental-preparations?assetId=...
async function list(req, res) {
  const { assetId } = req.query;
  // Falta, vacío o repetido (?assetId=a&assetId=b llega como array).
  if (typeof assetId !== 'string' || assetId.trim() === '') {
    return res.status(400).json({ error: 'Falta el parametro assetId' });
  }

  try {
    const rentals = await rentalPreparationService.listByAsset(assetId);
    if (rentals === null) {
      return res.status(404).json({ error: 'No existe el bien' });
    }
    res.json(rentals);
  } catch (err) {
    // El detalle (puede incluir la connection string) va al log, no a la respuesta.
    console.error('rental-preparations: fallo la consulta de tareas de preparacion', err);
    res.status(500).json({ error: 'No se pudieron obtener las tareas de preparacion' });
  }
}

// POST /api/rental-preparations/tasks  { reservationId, name, assignedToId }
async function create(req, res) {
  try {
    // Sin body (o sin Content-Type) req.body llega undefined.
    const result = await rentalPreparationService.createTask(req.body ?? {});
    if (!result.ok) {
      // `error` es el contrato de siempre; `errors` trae cada mensaje por separado
      // para mostrarlos todos juntos.
      return res.status(result.status).json({ error: result.errors.join('. '), errors: result.errors });
    }
    res.status(201).json(result.task);
  } catch (err) {
    console.error('rental-preparations: fallo el alta de la tarea de preparacion', err);
    res.status(500).json({ error: 'No se pudo crear la tarea de preparacion' });
  }
}

module.exports = { list, create };
