const { Router } = require('express');
const controller = require('../controllers/reservation.controller');

const router = Router();

// GET /api/reservations?assetId=...&month=YYYY-MM
router.get('/', controller.listForCalendar);

// GET /api/reservations/pending?assetId=...
router.get('/pending', controller.listPending);

// POST /api/reservations  (solicitar turno de uso propio)
router.post('/', controller.create);

// POST /api/reservations/:id/votes  (votar una solicitud de uso propio)
router.post('/:id/votes', controller.voteUse);

// POST /api/reservations/:id/cancellation  (cancelar un turno de uso propio)
router.post('/:id/cancellation', controller.cancelUse);

module.exports = router;
