// Error con status HTTP. Lo tiran las reglas y los casos de uso de
// Movimientos; el controller lo convierte en { error: mensaje } con ese status.
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const badRequest = (message) => new HttpError(400, message);
const forbidden = (message) => new HttpError(403, message);
const notFound = (message) => new HttpError(404, message);

module.exports = { HttpError, badRequest, forbidden, notFound };
