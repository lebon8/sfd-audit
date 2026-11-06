'use strict';
//require('dotenv').config();
const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../../.env')
});
const { RoleGatewayClient } = require('../fabric-gateway/role-gateway');
const { CorrelationStore } = require('../db/correlation');
const { summarize, runWithConcurrency, arg } = require('./stats');

(async () => {
  const count = parseInt(arg('--count', '1000'), 10);
  const concurrency = parseInt(arg('--concurrency', '20'), 10);

  const store = new CorrelationStore();
  const rows = (await store.findEventsByPeriod('2000-01-01T00:00:00Z', new Date().toISOString())).slice(0, count);
  await store.close();
  if (rows.length === 0) { console.log('Aucun evenement indexe. Lancez bench-write --index d abord.'); process.exit(0); }

  const gateway = new RoleGatewayClient('reader').connect();
  const latencies = []; let ok = 0, ko = 0;

  const wall0 = Date.now();
  await runWithConcurrency(rows, async (r) => {
    const t0 = Date.now();
    try { await gateway.evaluate('getAttestedEvent', r.event_id); latencies.push(Date.now() - t0); ok++; }
    catch { ko++; }
  }, concurrency);
  const wall = Date.now() - wall0;

  console.log(`\n=== LECTURE : ${rows.length} lectures, concurrence ${concurrency} ===`);
  console.log(JSON.stringify(summarize(latencies, wall, ok, ko), null, 2));
  gateway.close();
})().catch((e) => { console.error('Erreur bench-read :', e.message); process.exit(1); });