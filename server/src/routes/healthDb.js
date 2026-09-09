const { Router } = require('express');
const prisma = require('../prisma');

const router = Router();

// GET /api/health/db -> readiness check: confirma que el server llega a la
// base (Neon) haciendo un SELECT 1. A diferencia de /api/health (liveness),
// este endpoint SI toca la base, por eso puede responder 503.
router.get('/', async (req, res) => {
  try {
    await prisma.checkConnection();
    res.json({ status: 'ok', db: 'ok' });
  } catch (err) {
    console.error('health/db: fallo la consulta contra la base', err);
    res.status(503).json({ status: 'ok', db: 'error' });
  }
});

module.exports = router;
