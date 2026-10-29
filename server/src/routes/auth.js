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

// El alta si dice "ese mail ya esta registrado" (la historia lo pide), asi
// que es otra forma de averiguar quien tiene cuenta. Aca cuentan todas las
// altas, tambien las que salen bien: nadie crea veinte cuentas en un rato.
const ALTAS_DE_CUENTA = 20;

const limitarAltas = rateLimit({
  windowMs: VENTANA_MINUTOS * 60 * 1000,
  limit: ALTAS_DE_CUENTA,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Esperá unos minutos y probá de nuevo.' },
});

const router = Router();

// POST /api/auth/login  (entrar con mail y contrasena)
router.post('/login', limitarIntentos, controller.login);

// POST /api/auth/register  (crear cuenta y entrar)
router.post('/register', limitarAltas, controller.register);

module.exports = router;
module.exports.INTENTOS_DE_LOGIN = INTENTOS_DE_LOGIN;
module.exports.ALTAS_DE_CUENTA = ALTAS_DE_CUENTA;
