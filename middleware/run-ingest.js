'use strict';

require('dotenv').config();
const { runIngestCycle } = require('./ingest-service');

runIngestCycle()
  .then((r) => console.log(`Cycle termine : ${r.anchored} ancres, ${r.failed} echecs, sur ${r.consumed} consommes.`))
  .catch((e) => { console.error('Erreur cycle :', e.message); process.exit(1); });