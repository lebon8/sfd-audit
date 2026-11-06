'use strict';
require('dotenv').config();
const path = require('path');
const CSVAdapter = require('./adapters/csv-adapter');
const { RoleGatewayClient } = require('./fabric-gateway/role-gateway');
const { CorrelationStore } = require('./db/correlation');
const { anchorEnvelopes } = require('./ingest-core');

const file = process.argv[2] || path.join(__dirname, '..', 'sig-simulator', 'legacy-export.csv');
const mapping = require('./adapters/csv-mapping.json');

(async () => {
  const adapter = new CSVAdapter({ filePath: file, mapping, delimiter: ';' });
  await adapter.connect();
  const envelopes = await adapter.consume();

  const gateway = new RoleGatewayClient('writer').connect();
  const store = new CorrelationStore();
  try {
    const r = await anchorEnvelopes(envelopes, { gateway, store });
    console.log(`CSV "${path.basename(file)}" : ${r.anchored} ancres, ${r.duplicate} doublons, ${r.rejected} rejetes, ${r.failed} echecs (sur ${r.total}).`);
  } finally {
    await store.close(); gateway.close(); await adapter.disconnect();
  }
})().catch((e) => { console.error('Erreur CSV :', e.message); process.exit(1); });