'use strict';
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
const SIG_API_KEY = process.env.SIG_API_KEY || 'demo-sig-key-123';

function requireApiKey(req, res, next) {
  if (req.get('X-SIG-API-Key') !== SIG_API_KEY) return res.status(401).json({ error: 'Cle API invalide' });
  next();
}
function requireJwt(req, res, next) {
  const auth = req.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token JWT absent' });
  try { req.user = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }); next(); }
  catch { return res.status(401).json({ error: 'Token JWT invalide ou expire' }); }
}
function issueToken(subject, role) { return jwt.sign({ sub: subject, role }, JWT_SECRET, { expiresIn: '1h' }); }

module.exports = { requireApiKey, requireJwt, issueToken };