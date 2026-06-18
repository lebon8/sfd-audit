'use strict';
const express = require('express');
const { requireApiKey } = require('../middleware/auth');
const { runIngestCycle } = require('../../ingest-service');
const router = express.Router();
router.post('/', requireApiKey, async (req, res) => {
  try { res.json({ status: 'ok', ...(await runIngestCycle()) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
module.exports = router;