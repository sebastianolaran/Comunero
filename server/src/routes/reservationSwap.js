const { Router } = require('express');
const controller = require('../controllers/reservationSwap.controller');

const router = Router();

router.get('/', controller.list);
router.get('/options', controller.options);
router.post('/', controller.propose);
router.post('/:id/response', controller.respond);
router.post('/:id/cancellation', controller.cancel);

module.exports = router;
