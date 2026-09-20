const { Router } = require('express');
const rentalPreparationController = require('../controllers/rentalPreparation.controller');

const router = Router();

router.get('/', rentalPreparationController.list);
router.post('/tasks', rentalPreparationController.create);
router.patch('/tasks/:id', rentalPreparationController.update);
router.delete('/tasks/:id', rentalPreparationController.remove);

module.exports = router;
