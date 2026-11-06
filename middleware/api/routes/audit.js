'use strict';
const express = require('express');
const { requireJwt, requireRole } = require('../middleware/auth');
const { negotiate } = require('../content-negotiation');
const { getStore } = require('../context');
const { runAuditCycle } = require('../../audit-service');
const router = express.Router();

router.get('/alerts', requireJwt, requireRole('sfd_auditor'), async (req, res) => {
  try { negotiate(req, res, await getStore().findAlerts(req.query), 'alert'); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/run', requireJwt, requireRole('sfd_auditor'), async (req, res) => {
  try {
    const { periodFrom = '2000-01-01T00:00:00Z', periodTo = new Date().toISOString() } = req.body || {};
    res.json({ status: 'ok', ...(await runAuditCycle(periodFrom, periodTo)) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
module.exports = router;