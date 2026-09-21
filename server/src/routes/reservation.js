const { Router } = require('express');
const controller = require('../controllers/reservation.controller');

const router = Router();

// GET /api/reservations?assetId=...&month=YYYY-MM
router.get('/', controller.listForCalendar);

// POST /api/reservations  (solicitar turno de uso propio)
router.post('/', controller.create);

module.exports = router;
