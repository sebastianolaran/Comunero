const { Router } = require('express');
const { rateLimit } = require('express-rate-limit');
const controller = require('../controllers/auth.controller');

// El mensaje del login es a proposito indistinguible entre "ese mail no
// existe" y "esa contrasena no es", asi que lo unico que le queda a quien
// quiera adivinar credenciales es probar de a muchas. Esto le pone un tope.
const INTENTOS_DE_LOGIN = 10;
const VENTANA_MINUTOS = 15;

const limitarIntentos = rateLimit({
  windowMs: VENTANA_MINUTOS * 60 * 1000,
  limit: INTENTOS_DE_LOGIN,
  // Solo cuentan los intentos que no entraron: a quien se loguea bien no hay
  // por que cortarlo.
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Esperá unos minutos y probá de nuevo.' },
});

const router = Router();

// POST /api/auth/login  (entrar con mail y contrasena)
router.post('/login', limitarIntentos, controller.login);

module.exports = router;
module.exports.INTENTOS_DE_LOGIN = INTENTOS_DE_LOGIN;
