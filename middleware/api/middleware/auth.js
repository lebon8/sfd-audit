'use strict';
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const JWT_MIN_LENGTH = 32;
const ROLES = new Set(['sfd_writer', 'sfd_reader', 'sfd_auditor']);

function isConfigured(secret, minimumBytes = 1) {
  return typeof secret === 'string' && Buffer.byteLength(secret, 'utf8') >= minimumBytes;
}

function requireApiKey(req, res, next) {
  const expected = process.env.SIG_API_KEY;
  if (!isConfigured(expected, 32)) {
    return res.status(503).json({ error: 'Authentification API non configuree' });
  }
  const supplied = req.get('X-SIG-API-Key') || '';
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  if (suppliedBuffer.length !== expectedBuffer.length
      || !crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)) {
    return res.status(401).json({ error: 'Cle API invalide' });
  }
  next();
}

function requireJwt(req, res, next) {
  const secret = process.env.JWT_SECRET;
  if (!isConfigured(secret, JWT_MIN_LENGTH)) {
    return res.status(503).json({ error: 'Authentification JWT non configuree' });
  }
  const auth = req.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token JWT absent' });
  try { req.user = jwt.verify(token, secret, { algorithms: ['HS256'] }); }
  catch { return res.status(401).json({ error: 'Token JWT invalide ou expire' }); }
  return next();
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentification requise' });
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Permissions insuffisantes' });
    }
    next();
  };
}

function issueToken(subject, role) {
  const secret = process.env.JWT_SECRET;
  if (!isConfigured(secret, JWT_MIN_LENGTH)) {
    throw new Error('JWT_SECRET absent ou trop court (32 octets minimum)');
  }
  if (!subject || !ROLES.has(role)) throw new Error('Sujet ou role JWT invalide');
  return jwt.sign({ sub: subject, role }, secret, { expiresIn: '1h', algorithm: 'HS256' });
}

module.exports = { requireApiKey, requireJwt, requireRole, issueToken };