'use strict';
const express = require('express');
const { requireApiKey, issueToken } = require('../middleware/auth');
const router = express.Router();
router.post('/token', requireApiKey, (req, res) =>
  res.json({ token: issueToken((req.body && req.body.subject) || 'auditor', 'auditor'), expiresIn: 3600 }));
module.exports = router;