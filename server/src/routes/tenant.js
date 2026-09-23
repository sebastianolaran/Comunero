const { Router } = require('express');
const tenantController = require('../controllers/tenant.controller');

const router = Router();

router.get('/', tenantController.list);
router.get('/:id', tenantController.detail);
router.patch('/:id', tenantController.rate);
router.post('/:id/comments', tenantController.comment);

module.exports = router;
