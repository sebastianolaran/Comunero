const { randomBytes, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');

const scryptAsync = promisify(scrypt);

// Formato guardado: scrypt$<salt hex>$<derivada hex>. El prefijo con el
// algoritmo deja migrar a otro sin tener que adivinar como se genero cada
// hash viejo.
const ALGORITMO = 'scrypt';
const LARGO_SALT = 16;
const LARGO_CLAVE = 64;

async function hashPassword(password) {
  const salt = randomBytes(LARGO_SALT);
  const derivada = await scryptAsync(password, salt, LARGO_CLAVE);

  return `${ALGORITMO}$${salt.toString('hex')}$${derivada.toString('hex')}`;
}

async function verifyPassword(password, guardado) {
  if (typeof password !== 'string' || typeof guardado !== 'string') {
    return false;
  }

  const [algoritmo, saltHex, hashHex] = guardado.split('$');
  if (algoritmo !== ALGORITMO || !saltHex || !hashHex) {
    return false;
  }

  const esperado = Buffer.from(hashHex, 'hex');
  // timingSafeEqual tira si los buffers miden distinto, asi que un hash
  // truncado tiene que salir por aca y no por la comparacion.
  if (esperado.length !== LARGO_CLAVE) {
    return false;
  }

  const derivada = await scryptAsync(password, Buffer.from(saltHex, 'hex'), LARGO_CLAVE);

  return timingSafeEqual(derivada, esperado);
}

module.exports = { hashPassword, verifyPassword };
