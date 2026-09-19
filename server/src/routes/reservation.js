const { Router } = require('express');
const controller = require('../controllers/reservation.controller');

const router = Router();

// GET /api/reservations?assetId=...&month=YYYY-MM
router.get('/', controller.listForCalendar);

module.exports = router;
