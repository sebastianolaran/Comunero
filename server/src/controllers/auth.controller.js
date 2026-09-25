const authService = require('../services/auth.service');

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

module.exports = { login };
