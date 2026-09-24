const { Router } = require('express');
const controller = require('../controllers/movement.controller');

const router = Router();

// Las rutas fijas van antes de /:id.
router.get('/coowners', controller.listCoowners);
router.get('/periods', controller.listPeriods);

router.get('/', controller.list);
router.get('/:id', controller.get);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
