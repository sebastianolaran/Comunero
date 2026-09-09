const { Router } = require('express');

const router = Router();

// GET /api/health -> liveness check, sin tocar base de datos ni recursos.
router.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

module.exports = router;
