const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/index');

test('GET /api/health devuelve 200 y { status: "ok" }', async () => {
  const res = await request(app).get('/api/health');

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: 'ok' });
});
