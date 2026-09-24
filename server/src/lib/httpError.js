// Error con status HTTP. Lo tiran las reglas y los casos de uso de
// Movimientos y Balance; el controller lo convierte en { error: mensaje } con
// ese status (y, si trae details, esos campos al lado de error).
class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const badRequest = (message) => new HttpError(400, message);
const forbidden = (message) => new HttpError(403, message);
const notFound = (message) => new HttpError(404, message);
const conflict = (message, details) => new HttpError(409, message, details);

module.exports = { HttpError, badRequest, forbidden, notFound, conflict };
