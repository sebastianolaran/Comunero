const { Router } = require('express');
const controller = require('../controllers/balance.controller');

const router = Router();

router.get('/', controller.get);

module.exports = router;
