const prisma = require('../prisma');
const { hashPassword, verifyPassword } = require('../lib/password');

// Hash valido de una contrasena que nadie usa. Cuando el mail no existe igual
// se hace una verificacion contra este, para que responder "no existe" cueste
// lo mismo que responder "contrasena incorrecta": si no, el tiempo de
// respuesta delata que mails estan registrados.
const HASH_SENUELO = `scrypt$${'0'.repeat(32)}$${'0'.repeat(128)}`;

function normalizarEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

// Lo que ve el client. Sus bienes los pide aparte (GET /api/assets).
function sesionDe(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
  };
}

async function login(email, password) {
  const user = await prisma.user.findUnique({
    where: { email: normalizarEmail(email) },
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

async function duplicadoDe({ email, phone }) {
  const existente = await prisma.user.findFirst({
    where: { OR: [{ email }, { phone }] },
    select: { email: true, phone: true },
  });
  if (!existente) return null;
  return existente.email === email ? 'EMAIL_TAKEN' : 'PHONE_TAKEN';
}

// Prisma tira P2002 cuando choca un @unique; meta.target dice en qué campo,
// aunque según el driver puede venir vacío: ahí se vuelve a preguntar.
async function campoDuplicado(err, datos) {
  if (err?.code !== 'P2002') return null;
  const target = String(err.meta?.target ?? '');
  if (target.includes('email')) return 'EMAIL_TAKEN';
  if (target.includes('phone')) return 'PHONE_TAKEN';
  return (await duplicadoDe(datos)) ?? 'EMAIL_TAKEN';
}

// datos: ya validados y normalizados por auth.rules (validarRegistro).
// Devuelve { user } con la sesión, o { error: 'EMAIL_TAKEN' | 'PHONE_TAKEN' }.
async function register({ name, email, phone, password }) {
  const duplicado = await duplicadoDe({ email, phone });
  if (duplicado) return { error: duplicado };

  try {
    const user = await prisma.user.create({
      data: { name, email, phone, passwordHash: await hashPassword(password) },
    });
    return { user: sesionDe(user) };
  } catch (err) {
    // Dos altas con el mismo mail al mismo tiempo pasan las dos el chequeo de
    // arriba: el índice único de la base es el que decide.
    const enCarrera = await campoDuplicado(err, { email, phone });
    if (enCarrera) return { error: enCarrera };
    throw err;
  }
}

module.exports = { login, register };
