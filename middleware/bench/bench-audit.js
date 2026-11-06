'use strict';
//require('dotenv').config();
const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../../.env')
});
const { runAuditCycle } = require('../audit-service');

(async () => {
  const from = '2000-01-01T00:00:00Z';
  const to = new Date().toISOString();

  const t0 = Date.now();
  const r = await runAuditCycle(from, to);
  const wall = Date.now() - t0;

  console.log(`\n=== AUDIT ===`);
  console.log(`Evenements scannes : ${r.scanned}`);
  console.log(`Anomalies          : ${r.detected}`);
  console.log(`Duree              : ${(wall / 1000).toFixed(2)}s`);
  console.log(`Debit audit        : ${(r.scanned / (wall / 1000)).toFixed(1)} evenements/s`);
})().catch((e) => { console.error('Erreur bench-audit :', e.message); process.exit(1); });