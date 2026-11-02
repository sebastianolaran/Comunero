const { Router } = require('express');
const rentalRequestController = require('../controllers/rentalRequest.controller');

const router = Router();

router.get('/', rentalRequestController.list);
router.post('/', rentalRequestController.create);
router.post('/:id/votes', rentalRequestController.vote);
router.post('/:id/payment', rentalRequestController.markPaid);
router.post('/:id/cancellation', rentalRequestController.cancel);
router.patch('/:id/amount', rentalRequestController.updateAmount);

module.exports = router;
