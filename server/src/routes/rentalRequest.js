const { Router } = require('express');
const rentalRequestController = require('../controllers/rentalRequest.controller');

const router = Router();

router.get('/', rentalRequestController.list);

module.exports = router;
