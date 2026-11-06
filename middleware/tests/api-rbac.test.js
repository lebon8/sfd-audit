'use strict';

const express = require('express');
const { once } = require('events');
const jwt = require('jsonwebtoken');
const { issueToken } = require('../api/middleware/auth');

const protectedRoutes = [
  ['GET', '/api/v1/events/test-event'],
  ['POST', '/api/v1/verify'],
  ['GET', '/api/v1/audit/alerts'],
  ['POST', '/api/v1/audit/run'],
  ['POST', '/api/v1/reports/generate'],
  ['GET', '/api/v1/reports/RPT-1-ABCDEF/download'],
  ['POST', '/api/v1/reports/verify'],
  ['GET', '/api/v1/stats'],
];

describe('Autorisation des routes API', () => {
  let server;
  let baseUrl;
  let token;
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalApiKey = process.env.SIG_API_KEY;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-characters';
    process.env.SIG_API_KEY = 'test-api-key-that-is-at-least-32-characters';
    const app = express();
    app.use(express.json());
    app.use('/api/v1/auth', require('../api/routes/auth'));
    app.use('/api/v1/events', require('../api/routes/query'));
    app.use('/api/v1/verify', require('../api/routes/verify'));
    app.use('/api/v1/audit', require('../api/routes/audit'));
    app.use('/api/v1/reports', require('../api/routes/reports'));
    app.use('/api/v1/stats', require('../api/routes/stats'));
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    token = issueToken('writer', 'sfd_writer');
  });

  afterAll(async () => {
    if (server) {
      server.close();
      await once(server, 'close');
    }
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
    if (originalApiKey === undefined) delete process.env.SIG_API_KEY;
    else process.env.SIG_API_KEY = originalApiKey;
  });

  test('le endpoint de token ignore les rôles et sujets fournis par le client', async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SIG-API-Key': process.env.SIG_API_KEY,
      },
      body: JSON.stringify({ subject: 'writer', role: 'sfd_writer' }),
    });
    expect(response.status).toBe(200);
    const result = await response.json();
    const claims = jwt.verify(result.token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    expect(claims.sub).toBe('auditor');
    expect(claims.role).toBe('sfd_auditor');
  });

  test.each(protectedRoutes)('%s %s refuse un writer authentifie', async (method, route) => {
    const response = await fetch(`${baseUrl}${route}`, {
      method,
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(403);
  });
});
