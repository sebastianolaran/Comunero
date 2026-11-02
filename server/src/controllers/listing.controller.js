// Ficha pública, del lado de los copropietarios (Configuración).
// Modulo entero (no destructuring) para poder mockearlo en los tests.
const listingService = require('../services/listing.service');

const MAX_ID_LENGTH = 64;

const ERRORS = {
  ASSET_NOT_FOUND: [404, 'No existe el bien'],
  NOT_COOWNER: [403, 'Solo los copropietarios del bien pueden ver y cambiar la ficha'],
  TOO_MANY_PHOTOS: [409, 'La ficha ya tiene el máximo de fotos: sacá alguna para subir otra'],
  PHOTO_NOT_FOUND: [404, 'No existe la foto'],
};

function isId(value) {
  return typeof value === 'string' && value.trim() !== '' && value.length <= MAX_ID_LENGTH;
}

function sendResult(res, result, okStatus = 200) {
  if (result.error === 'INVALID') return res.status(400).json({ error: result.message, field: result.field });
  if (result.error) {
    const [status, message] = ERRORS[result.error];
    return res.status(status).json({ error: message });
  }
  return res.status(okStatus).json({ listing: result.listing });
}

// TODO: el userId tiene que salir de la sesion, como en el resto de la API.
function handler({ userIdFrom, run, failure, okStatus }) {
  return async (req, res) => {
    const userId = userIdFrom(req);
    if (!isId(userId)) return res.status(400).json({ error: 'Falta el copropietario' });
    try {
      sendResult(res, await run(req, userId), okStatus);
    } catch (err) {
      console.error(`listing: fallo ${failure}`, err);
      res.status(500).json({ error: `No se pudo ${failure}. Probá de nuevo en un momento.` });
    }
  };
}

const fromQuery = (req) => req.query.userId;
const fromBody = (req) => req.body?.userId;

const get = handler({
  userIdFrom: fromQuery,
  run: (req, userId) => listingService.getForCoowner({ assetId: req.params.id, userId }),
  failure: 'traer la ficha',
});

const save = handler({
  userIdFrom: fromBody,
  run: (req, userId) => listingService.save({ assetId: req.params.id, userId, body: req.body }),
  failure: 'guardar la ficha',
});

const addPhoto = handler({
  userIdFrom: fromBody,
  run: (req, userId) => listingService.addPhoto({ assetId: req.params.id, userId, body: req.body }),
  failure: 'subir la foto',
  okStatus: 201,
});

const removePhoto = handler({
  userIdFrom: fromBody,
  run: (req, userId) =>
    listingService.removePhoto({ assetId: req.params.id, userId, photoId: req.params.photoId }),
  failure: 'sacar la foto',
});

module.exports = { get, save, addPhoto, removePhoto };
