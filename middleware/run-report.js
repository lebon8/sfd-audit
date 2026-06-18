'use strict';
require('dotenv').config();
const { generateReport } = require('./report-service');

const from = process.env.AUDIT_FROM || '2000-01-01T00:00:00Z';
const to   = process.env.AUDIT_TO   || new Date().toISOString();

generateReport(from, to)
  .then((r) => {
    console.log(`Rapport genere : ${r.reportId}`);
    console.log(`  PDF         : ${r.pdfPath}`);
    console.log(`  Hash SHA-256: ${r.reportHash}`);
    console.log(`  Ancre txId  : ${r.blockchainTxId}`);
    console.log(`  Contenu     : ${r.events} evenements, ${r.alerts} anomalies`);
  })
  .catch((e) => { console.error('Erreur rapport :', e.message); process.exit(1); });