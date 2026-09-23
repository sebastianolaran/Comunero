const { Router } = require('express');
const tenantController = require('../controllers/tenant.controller');

const router = Router();

router.get('/', tenantController.list);

module.exports = router;
