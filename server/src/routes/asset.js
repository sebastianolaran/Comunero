const { Router } = require('express');
const { rateLimit } = require('express-rate-limit');
const controller = require('../controllers/asset.controller');
const settings = require('../controllers/assetSettings.controller');

// Como en el login: tope de códigos equivocados.
const INTENTOS_DE_CODIGO = 10;
const VENTANA_MINUTOS = 15;

const limitarIntentos = rateLimit({
  windowMs: VENTANA_MINUTOS * 60 * 1000,
  limit: INTENTOS_DE_CODIGO,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Esperá unos minutos y probá de nuevo.' },
});

const router = Router();

router.get('/', controller.list);
router.post('/', controller.create);
router.post('/join', limitarIntentos, controller.join);
router.get('/:id/settings', settings.get);
router.patch('/:id/settings', settings.update);

module.exports = router;
module.exports.INTENTOS_DE_CODIGO = INTENTOS_DE_CODIGO;
