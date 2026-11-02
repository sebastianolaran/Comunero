const { Router } = require('express');
const controller = require('../controllers/calendar.controller');

const router = Router();

// GET /api/calendar/export.ics?userId=...&assetId=...&scope=mine|use|all
router.get('/export.ics', controller.exportIcs);

module.exports = router;
