'use strict';
const express = require('express');
const fs = require('fs');
const path = require('path');
const { requireJwt, requireRole } = require('../middleware/auth');
const { generateReport, verifyReportByHash } = require('../../report-service');
const router = express.Router();

const REPORTS_DIR = path.join(__dirname, '..', '..', '..', 'reports');

router.post('/generate', requireJwt, requireRole('sfd_auditor'), async (req, res) => {
  try {
    const { periodFrom = '2000-01-01T00:00:00Z', periodTo = new Date().toISOString() } = req.body || {};
    const r = await generateReport(periodFrom, periodTo);
    res.json({ status: 'ok', reportId: r.reportId, reportHash: r.reportHash, blockchainTxId: r.blockchainTxId,
               events: r.events, alerts: r.alerts, downloadUrl: `/api/v1/reports/${r.reportId}/download` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:reportId/download', requireJwt, requireRole('sfd_reader', 'sfd_auditor'), (req, res) => {
  if (!/^RPT-\d+-[A-F0-9]{6}$/.test(req.params.reportId)) {
    return res.status(400).json({ error: 'Identifiant de rapport invalide' });
  }
  const file = path.join(REPORTS_DIR, `${req.params.reportId}.pdf`);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'PDF introuvable' });
  res.type('application/pdf').sendFile(file);
});

router.post('/verify', requireJwt, requireRole('sfd_reader', 'sfd_auditor'), async (req, res) => {
  const { reportId, fileHash } = req.body || {};
  if (!reportId || !fileHash) return res.status(400).json({ error: 'reportId et fileHash requis' });
  try { res.json(await verifyReportByHash(reportId, fileHash)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
module.exports = router;