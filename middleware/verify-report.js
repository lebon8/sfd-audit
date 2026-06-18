'use strict';
require('dotenv').config();
const { verifyReport } = require('./report-service');

const [reportId, filePath] = [process.argv[2], process.argv[3]];
if (!reportId || !filePath) {
  console.error('Usage : node middleware/verify-report.js <reportId> <chemin-pdf>');
  process.exit(1);
}
verifyReport(reportId, filePath)
  .then((r) => console.log(JSON.stringify(r, null, 2)))
  .catch((e) => { console.error('Erreur verification :', e.message); process.exit(1); });