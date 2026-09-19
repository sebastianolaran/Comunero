const { Router } = require('express');
const rentalPreparationController = require('../controllers/rentalPreparation.controller');

const router = Router();

router.get('/', rentalPreparationController.list);
router.post('/tasks', rentalPreparationController.create);

module.exports = router;
