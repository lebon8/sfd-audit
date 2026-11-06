'use strict';
const express = require('express');
const { requireApiKey, issueToken } = require('../middleware/auth');
const router = express.Router();
router.post('/token', requireApiKey, (req, res) => {
  if (!process.env.JWT_SECRET || Buffer.byteLength(process.env.JWT_SECRET, 'utf8') < 32) {
    return res.status(503).json({ error: 'Emission de token indisponible' });
  }
  return res.json({ token: issueToken('auditor', 'sfd_auditor'), expiresIn: 3600 });
});
module.exports = router;