const prisma = require('../prisma');
const { verifyPassword } = require('../lib/password');

// Hash valido de una contrasena que nadie usa. Cuando el mail no existe igual
// se hace una verificacion contra este, para que responder "no existe" cueste
// lo mismo que responder "contrasena incorrecta": si no, el tiempo de
// respuesta delata que mails estan registrados.
const HASH_SENUELO = `scrypt$${'0'.repeat(32)}$${'0'.repeat(128)}`;

function normalizarEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

// Lo que ve el client. El assetId y el nombre del bien viajan aca para que la
// app muestre el bien del usuario que entro, en vez de uno fijo por config.
function sesionDe(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    assetId: user.assetId,
    assetName: user.asset.name,
  };
}

async function login(email, password) {
  const user = await prisma.user.findUnique({
    where: { email: normalizarEmail(email) },
    include: { asset: true },
  });

  if (!user) {
    await verifyPassword(password, HASH_SENUELO);
    return null;
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    return null;
  }

  return sesionDe(user);
}

module.exports = { login };
