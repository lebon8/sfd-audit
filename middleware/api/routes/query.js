'use strict';
const express = require('express');
const { requireJwt } = require('../middleware/auth');
const { negotiate } = require('../content-negotiation');
const { getGateway, getStore } = require('../context');
const router = express.Router();

router.get('/', requireJwt, async (req, res) => {
  try {
    const { type, from = '2000-01-01T00:00:00Z', to = new Date().toISOString() } = req.query;
    let rows = await getStore().findEventsByPeriod(from, to);
    if (type) rows = rows.filter((r) => r.event_type === type);
    negotiate(req, res, rows, 'event');
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:eventId', requireJwt, async (req, res) => {
  try { negotiate(req, res, JSON.parse(await getGateway().evaluate('getAttestedEvent', req.params.eventId)), 'event'); }
  catch { res.status(404).json({ error: 'Evenement introuvable' }); }
});
module.exports = router;