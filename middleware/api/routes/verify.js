'use strict';
const express = require('express');
const { requireJwt } = require('../middleware/auth');
const { getGateway } = require('../context');
const { canonicalStringify } = require('../../engine/hasher');
const router = express.Router();

router.post('/', requireJwt, async (req, res) => {
  const { eventId, payload } = req.body || {};
  if (!eventId || payload === undefined) return res.status(400).json({ error: 'eventId et payload requis' });
  try {
    const payloadJson = typeof payload === 'string' ? payload : canonicalStringify(payload);
    res.json(JSON.parse(await getGateway().evaluate('verifyEventIntegrity', eventId, payloadJson)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
module.exports = router;