'use strict';
const express = require('express');
const { requireJwt } = require('../middleware/auth');
const { getStats } = require('../../report-service');
const router = express.Router();

router.get('/', requireJwt, async (req, res) => {
  try {
    const { from = '2000-01-01T00:00:00Z', to = new Date().toISOString() } = req.query;
    res.json(await getStats(from, to));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;