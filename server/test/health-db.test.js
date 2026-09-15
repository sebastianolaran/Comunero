const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/index');
const prisma = require('../src/prisma');

// El endpoint de readiness prueba la cadena server -> Postgres (Neon) sin
// depender de una base real: se mockea prisma.$queryRaw.

test('GET /api/health/db responde 200 y db:ok cuando la consulta funciona', async (t) => {
  t.mock.method(prisma, 'checkConnection', async () => {});

  const res = await request(app).get('/api/health/db');

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: 'ok', db: 'ok' });
});

test('GET /api/health/db responde 503 y db:error cuando la base falla', async (t) => {
  t.mock.method(prisma, 'checkConnection', async () => {
    throw new Error('conexion rechazada');
  });
  t.mock.method(console, 'error', () => {}); // la ruta loguea el error; lo silenciamos en el test



  const res = await request(app).get('/api/health/db');

  assert.equal(res.status, 503);
  assert.deepEqual(res.body, { status: 'ok', db: 'error' });
});
