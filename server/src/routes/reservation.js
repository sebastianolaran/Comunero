const { Router } = require('express');
const controller = require('../controllers/reservation.controller');
const rentalController = require('../controllers/rental.controller');

const router = Router();

// GET /api/reservations?assetId=...&month=YYYY-MM
router.get('/', controller.listForCalendar);

// POST /api/reservations  (solicitar turno de uso propio)
router.post('/', controller.create);

// POST /api/reservations/rental  (solicitar alquiler a terceros)
router.post('/rental', rentalController.create);

module.exports = router;
