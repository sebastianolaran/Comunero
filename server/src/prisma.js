const { PrismaClient } = require('@prisma/client');

// Instancia unica de Prisma Client para todo el server.
// Se conecta de forma perezosa: la primera query abre la conexion contra
// la base definida en DATABASE_URL (Neon en produccion).
const prisma = new PrismaClient();

// Ping de readiness. Vive aca (y no inline en la ruta) para poder mockearlo
// en los tests sin depender de una base real.
prisma.checkConnection = async function checkConnection() {
  await prisma.$queryRaw`SELECT 1`;
};

module.exports = prisma;
