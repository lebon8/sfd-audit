'use strict';
const express = require('express');
const { requireJwt, requireRole } = require('../middleware/auth');
const { negotiate } = require('../content-negotiation');
const { getGateway, getStore } = require('../context');
const router = express.Router();

router.get('/', requireJwt, requireRole('sfd_reader', 'sfd_auditor'), async (req, res) => {
  try {
    const { type, from = '2000-01-01T00:00:00Z', to = new Date().toISOString() } = req.query;
    let rows = await getStore().findEventsByPeriod(from, to);
    if (type) rows = rows.filter((r) => r.event_type === type);
    negotiate(req, res, rows, 'event');
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:eventId', requireJwt, requireRole('sfd_reader', 'sfd_auditor'), async (req, res) => {
  try { negotiate(req, res, JSON.parse(await getGateway('reader').evaluate('getAttestedEvent', req.params.eventId)), 'event'); }
  catch (error) {
    if (/introuvable|not found|does not exist/i.test(error?.message || '')) {
      return res.status(404).json({ error: 'Evenement introuvable' });
    }
    return res.status(502).json({ error: 'Lecture Fabric impossible' });
  }
});
module.exports = router;