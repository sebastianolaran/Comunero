// Mismas reglas y mensajes que el server (services/auth.rules.js): validar
// acá evita el viaje para lo obvio, y el server igual vuelve a chequear todo.
const MAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TELEFONO_RE = /^[\d\s()+.-]+$/
const MAX_NOMBRE = 100
const MAX_MAIL = 254
const MAX_TELEFONO = 30
const MIN_DIGITOS = 8
const MAX_DIGITOS = 15
const MIN_PASSWORD = 8
const MAX_PASSWORD = 128

export function validarRegistro({ nombre, email, telefono, password }) {
  const errores = {}
  const nom = nombre.trim()
  const mail = email.trim()
  const digitos = telefono.replace(/\D/g, '')

  if (!nom) errores.nombre = 'Falta el nombre.'
  else if (nom.length > MAX_NOMBRE) errores.nombre = `El nombre no puede superar los ${MAX_NOMBRE} caracteres.`

  if (!mail) errores.email = 'Falta el mail.'
  else if (mail.length > MAX_MAIL || !MAIL_RE.test(mail)) errores.email = 'El mail no es válido.'

  if (!telefono.trim()) errores.telefono = 'Falta el teléfono.'
  else if (telefono.length > MAX_TELEFONO) errores.telefono = 'El teléfono es demasiado largo.'
  else if (!TELEFONO_RE.test(telefono)) errores.telefono = 'El teléfono solo puede tener números.'
  else if (digitos.length < MIN_DIGITOS || digitos.length > MAX_DIGITOS) {
    errores.telefono = `El teléfono tiene que tener entre ${MIN_DIGITOS} y ${MAX_DIGITOS} números.`
  }

  // La contraseña no se recorta: los espacios son parte de la contraseña,
  // pero una hecha solo de espacios no sirve.
  if (!password) errores.password = 'Falta la contraseña.'
  else if (password.length < MIN_PASSWORD) {
    errores.password = `La contraseña tiene que tener ${MIN_PASSWORD} caracteres como mínimo.`
  } else if (password.length > MAX_PASSWORD) {
    errores.password = `La contraseña no puede superar los ${MAX_PASSWORD} caracteres.`
  } else if (!password.trim()) errores.password = 'La contraseña no es válida.'

  return errores
}
