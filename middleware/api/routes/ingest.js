'use strict';
const express = require('express');
const { requireApiKey } = require('../middleware/auth');
const { runIngestCycle } = require('../../ingest-service');
const { anchorEnvelopes } = require('../../ingest-core');
const WebhookAdapter = require('../../adapters/webhook-adapter');
const { getGateway, getStore } = require('../context');
const router = express.Router();

// Mode 1 : polling JDBC (declenche un cycle sur la base SIG)
router.post('/', requireApiKey, async (req, res) => {
  try { res.json({ status: 'ok', mode: 'jdbc', ...(await runIngestCycle()) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// Mode 2 : webhook push (le SIG POST ses evenements)
router.post('/webhook', requireApiKey, async (req, res) => {
  try {
    const body = req.body || {};
    const records = Array.isArray(body.data) ? body.data : (Array.isArray(body) ? body : [body]);
    const envelopes = new WebhookAdapter().toEnvelopes(records);
    const r = await anchorEnvelopes(envelopes, { gateway: getGateway('writer'), store: getStore() });
    res.json({ status: 'ok', mode: 'webhook', ...r });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;