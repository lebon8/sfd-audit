'use strict';
require('dotenv').config();
const { runAuditCycle } = require('./audit-service');

const from = process.env.AUDIT_FROM || '2000-01-01T00:00:00Z';
const to   = process.env.AUDIT_TO   || new Date().toISOString();

runAuditCycle(from, to)
  .then((r) => console.log(`Audit termine : ${r.scanned} scannes, ${r.detected} anomalies, ${r.anchored} ancrees, ${r.skipped} ignorees, ${r.failed} echecs.`))
  .catch((e) => { console.error('Erreur audit :', e.message); process.exit(1); });