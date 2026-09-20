const { Router } = require('express');
const rentalRequestController = require('../controllers/rentalRequest.controller');

const router = Router();

router.get('/', rentalRequestController.list);
router.post('/', rentalRequestController.create);
router.post('/:id/votes', rentalRequestController.vote);

module.exports = router;
