// Reglas del alta de cuenta que no tocan la base (se testean sin base).
// El client valida lo mismo con los mismos mensajes, en lib/registro.js.

const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;
const MAX_PHONE_LENGTH = 30;
const MIN_PHONE_DIGITS = 8;
// E.164: con el código de país incluido, un número no pasa de 15 dígitos.
const MAX_PHONE_DIGITS = 15;
const MIN_PASSWORD_LENGTH = 8;
// scrypt procesa la contraseña entera: sin tope, un body enorme ocupa CPU.
const MAX_PASSWORD_LENGTH = 128;

// Mismo criterio que el login: un arroba, algo antes, y un punto después.
const MAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_CHARS = /^[\d\s()+.-]+$/;

function texto(value) {
  return typeof value === 'string' ? value : '';
}

function errorDeNombre(name) {
  if (!name) return 'Falta el nombre.';
  if (name.length > MAX_NAME_LENGTH) return `El nombre no puede superar los ${MAX_NAME_LENGTH} caracteres.`;
  return null;
}

function errorDeMail(email) {
  if (!email) return 'Falta el mail.';
  if (email.length > MAX_EMAIL_LENGTH || !MAIL_RE.test(email)) return 'El mail no es válido.';
  return null;
}

function errorDeTelefono(phone, digits) {
  if (!phone.trim()) return 'Falta el teléfono.';
  if (phone.length > MAX_PHONE_LENGTH) return 'El teléfono es demasiado largo.';
  if (!PHONE_CHARS.test(phone)) return 'El teléfono solo puede tener números.';
  if (digits.length < MIN_PHONE_DIGITS || digits.length > MAX_PHONE_DIGITS) {
    return `El teléfono tiene que tener entre ${MIN_PHONE_DIGITS} y ${MAX_PHONE_DIGITS} números.`;
  }
  return null;
}

// La contraseña no se recorta (los espacios son parte de ella), pero una
// hecha solo de espacios no protege nada aunque llegue al mínimo.
function errorDeContrasena(password) {
  if (!password) return 'Falta la contraseña.';
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `La contraseña tiene que tener ${MIN_PASSWORD_LENGTH} caracteres como mínimo.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `La contraseña no puede superar los ${MAX_PASSWORD_LENGTH} caracteres.`;
  }
  if (!password.trim()) return 'La contraseña no es válida.';
  return null;
}

// { datos } con todo normalizado, o { errores } con un mensaje por campo.
function validarRegistro({ name, email, phone, password } = {}) {
  const nombre = texto(name).trim();
  // Se guarda como en el login: minúsculas y sin espacios alrededor.
  const mail = texto(email).trim().toLowerCase();
  const telefono = texto(phone);
  const digitos = telefono.replace(/\D/g, '');
  const contrasena = texto(password);

  const errores = {};
  const agregar = (campo, error) => {
    if (error) errores[campo] = error;
  };
  agregar('name', errorDeNombre(nombre));
  agregar('email', errorDeMail(mail));
  agregar('phone', errorDeTelefono(telefono, digitos));
  agregar('password', errorDeContrasena(contrasena));

  if (Object.keys(errores).length > 0) return { errores };
  return { datos: { name: nombre, email: mail, phone: digitos, password: contrasena } };
}

module.exports = { validarRegistro, MIN_PASSWORD_LENGTH };
