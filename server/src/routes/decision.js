const { Router } = require('express');
const decisionController = require('../controllers/decision.controller');

const router = Router();

router.get('/', decisionController.list);
router.post('/', decisionController.create);

module.exports = router;
