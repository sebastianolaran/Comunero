const authService = require('../services/auth.service');
const { validarRegistro } = require('../services/auth.rules');

// Un solo texto para "ese mail no existe" y para "esa contrasena no es":
// dos mensajes distintos dejarian averiguar quien esta registrado probando
// mails contra el login.
const CREDENCIALES_INVALIDAS = 'El mail o la contraseña no coinciden. Revisalos y probá de nuevo.';

// POST /api/auth/login
// body: { email, password }
//
// Devuelve los datos de sesion del usuario, con el bien al que pertenece,
// para que el client muestre el bien de quien entro y no uno fijo por config.
async function login(req, res) {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Faltan el mail o la contraseña' });
  }

  try {
    const user = await authService.login(email, password);

    if (!user) {
      return res.status(401).json({ error: CREDENCIALES_INVALIDAS });
    }

    res.json({ user });
  } catch (err) {
    // El detalle (puede incluir la connection string) va al log, no a la
    // respuesta: sin este catch, Express responde HTML con el stack adentro.
    console.error('auth: fallo el login', err);
    res.status(500).json({ error: 'No pudimos entrar. Probá de nuevo en un momento.' });
  }
}

const DUPLICADOS = {
  EMAIL_TAKEN: { email: 'Ese mail ya está registrado.' },
  PHONE_TAKEN: { phone: 'Ese teléfono ya está registrado.' },
};

// POST /api/auth/register
// body: { name, email, phone, password }
//
// Crea la cuenta y devuelve la misma sesión que el login, así quien se
// registra entra directo sin loguearse aparte. Los errores van por campo
// (fields) para que el formulario los muestre al lado de cada uno.
async function register(req, res) {
  const { errores, datos } = validarRegistro(req.body ?? {});
  if (errores) {
    return res.status(400).json({ error: 'Revisá los datos marcados.', fields: errores });
  }

  try {
    const result = await authService.register(datos);
    if (result.error) {
      const fields = DUPLICADOS[result.error];
      return res.status(409).json({ error: Object.values(fields)[0], fields });
    }
    res.status(201).json({ user: result.user });
  } catch (err) {
    // Solo el código: el error de Prisma trae los datos del create (con el
    // passwordHash y el teléfono), y eso no tiene que quedar en el log.
    console.error('auth: fallo el alta de cuenta', err?.code ?? err?.name);
    res.status(500).json({ error: 'No pudimos crear la cuenta. Probá de nuevo en un momento.' });
  }
}

module.exports = { login, register };
