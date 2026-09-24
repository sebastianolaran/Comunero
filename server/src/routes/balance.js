const { Router } = require('express');
const controller = require('../controllers/balance.controller');

const router = Router();

router.get('/', controller.get);
router.post('/close', controller.close);

module.exports = router;
