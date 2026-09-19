const { Router } = require('express');
const rentalPreparationController = require('../controllers/rentalPreparation.controller');

const router = Router();

router.get('/', rentalPreparationController.list);

module.exports = router;
