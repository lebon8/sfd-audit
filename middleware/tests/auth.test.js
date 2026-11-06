'use strict';

const { requireApiKey, requireJwt, requireRole, issueToken } = require('../api/middleware/auth');

function request(headers = {}) {
  return { get: (name) => headers[name.toLowerCase()] };
}

function response() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

describe('Authentification et autorisation HTTP', () => {
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalApiKey = process.env.SIG_API_KEY;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-characters';
    process.env.SIG_API_KEY = 'test-api-key-that-is-at-least-32-characters';
  });

  afterAll(() => {
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
    if (originalApiKey === undefined) delete process.env.SIG_API_KEY;
    else process.env.SIG_API_KEY = originalApiKey;
  });

  test('refuse une API key absente de la configuration', () => {
    delete process.env.SIG_API_KEY;
    const res = response();
    requireApiKey(request(), res, jest.fn());
    expect(res.statusCode).toBe(503);

    process.env.SIG_API_KEY = 'too-short';
    const shortKeyResponse = response();
    requireApiKey(request({ 'x-sig-api-key': process.env.SIG_API_KEY }), shortKeyResponse, jest.fn());
    expect(shortKeyResponse.statusCode).toBe(503);
  });

  test('compare la clé API et n accepte que la valeur configurée', () => {
    const next = jest.fn();
    const accepted = response();
    requireApiKey(request({ 'x-sig-api-key': process.env.SIG_API_KEY }), accepted, next);
    expect(next).toHaveBeenCalledTimes(1);

    const rejected = response();
    requireApiKey(request({ 'x-sig-api-key': 'wrong-key' }), rejected, next);
    expect(rejected.statusCode).toBe(401);
  });

  test('refuse un JWT si le secret est absent ou trop court', () => {
    const res = response();
    delete process.env.JWT_SECRET;
    requireJwt(request({ authorization: 'Bearer invalid' }), res, jest.fn());
    expect(res.statusCode).toBe(503);

    process.env.JWT_SECRET = 'too-short';
    const shortSecretResponse = response();
    requireJwt(request({ authorization: 'Bearer invalid' }), shortSecretResponse, jest.fn());
    expect(shortSecretResponse.statusCode).toBe(503);
  });

  test('valide le JWT signé et refuse un token invalide ou absent', () => {
    const token = issueToken('auditor', 'sfd_auditor');
    const next = jest.fn();
    const accepted = response();
    const req = request({ authorization: `Bearer ${token}` });
    requireJwt(req, accepted, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user.role).toBe('sfd_auditor');

    const invalid = response();
    requireJwt(request({ authorization: 'Bearer invalid' }), invalid, jest.fn());
    expect(invalid.statusCode).toBe(401);

    const missing = response();
    requireJwt(request(), missing, jest.fn());
    expect(missing.statusCode).toBe(401);
  });

  test('applique le rôle signé, et non une valeur de requête', () => {
    const next = jest.fn();
    const allowed = response();
    requireRole('sfd_auditor')(
      { user: { role: 'sfd_auditor' }, body: { role: 'sfd_writer' } },
      allowed,
      next
    );
    expect(next).toHaveBeenCalledTimes(1);

    const forbidden = response();
    requireRole('sfd_auditor')(
      { user: { role: 'sfd_writer' } },
      forbidden,
      jest.fn()
    );
    expect(forbidden.statusCode).toBe(403);
  });

  test('ne signe que des rôles connus', () => {
    expect(() => issueToken('subject', 'administrator')).toThrow('role JWT invalide');
  });
});
