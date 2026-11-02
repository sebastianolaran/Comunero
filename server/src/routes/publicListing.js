const { Router } = require('express');
const { rateLimit } = require('express-rate-limit');
const controller = require('../controllers/publicListing.controller');

// El formulario lo puede usar cualquiera con el link: alcanza para que una
// persona mande varias consultas, no para llenar Alquiler de solicitudes.
const SOLICITUDES_POR_IP = 5;
const VENTANA_MINUTOS = 60;

const limitarSolicitudes = rateLimit({
  windowMs: VENTANA_MINUTOS * 60 * 1000,
  limit: SOLICITUDES_POR_IP,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Se enviaron demasiadas solicitudes. Volver a intentar más tarde.' },
});

// Por ficha, aunque cambie la IP: con el link alcanza para mandar pedidos, y
// sin esto alguien con muchas IPs podría llenar Alquiler de solicitudes.
const SOLICITUDES_POR_FICHA = 30;
const UN_DIA_MS = 24 * 60 * 60 * 1000;

const limitarPorFicha = rateLimit({
  windowMs: UN_DIA_MS,
  limit: SOLICITUDES_POR_FICHA,
  keyGenerator: (req) => `ficha:${req.params.slug}`,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Esta ficha recibió muchas solicitudes hoy. Volver a intentar mañana.' },
});

// Lecturas: generoso para quien mira las fotos, pero cada foto sale de la base.
const LECTURAS_POR_IP = 300;
const QUINCE_MIN_MS = 15 * 60 * 1000;

const limitarLecturas = rateLimit({
  windowMs: QUINCE_MIN_MS,
  limit: LECTURAS_POR_IP,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiadas consultas. Volver a intentar en unos minutos.' },
});

const router = Router();

router.get('/:slug', limitarLecturas, controller.get);
router.get('/:slug/photos/:photoId', limitarLecturas, controller.photo);
router.get('/:slug/availability', limitarLecturas, controller.availability);
router.post('/:slug/requests', limitarSolicitudes, limitarPorFicha, controller.submitRequest);

module.exports = router;
module.exports.limitarLecturas = limitarLecturas;
module.exports.SOLICITUDES_POR_IP = SOLICITUDES_POR_IP;
module.exports.SOLICITUDES_POR_FICHA = SOLICITUDES_POR_FICHA;
