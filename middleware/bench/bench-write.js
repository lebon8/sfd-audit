'use strict';
require('dotenv').config();
const { GatewayClient } = require('../fabric-gateway/gateway');
const { CorrelationStore } = require('../db/correlation');
const { makeEvent } = require('./gen-events');
const { summarize, runWithConcurrency, arg } = require('./stats');

(async () => {
  const count = parseInt(arg('--count', '1000'), 10);
  const concurrency = parseInt(arg('--concurrency', '20'), 10);
  const doIndex = process.argv.includes('--index');   // pour préparer l'audit ensuite

  const events = Array.from({ length: count }, (_, i) => makeEvent(i));
  const gateway = new GatewayClient().connect();
  const store = doIndex ? new CorrelationStore() : null;

  const latencies = [];
  let ok = 0, ko = 0;
  const errors = {};

  const wall0 = Date.now();
  await runWithConcurrency(events, async (e) => {
    const t0 = Date.now();
    try {
      const { txId } = await gateway.submit('createAttestedEvent', e.eventId, e.eventType, e.payloadJson, e.sourceHash);
      if (store) await store.recordAttestation({ eventId: e.eventId, sigId: e.sigId, eventType: e.eventType,
        sourceHash: e.sourceHash, blockchainTxId: txId, eventTimestamp: e.eventTimestamp });
      latencies.push(Date.now() - t0); ok++;
    } catch (err) {
      ko++; const key = (err.message || 'unknown').slice(0, 40); errors[key] = (errors[key] || 0) + 1;
    }
  }, concurrency);
  const wall = Date.now() - wall0;

  console.log(`\n=== ECRITURE : ${count} tx, concurrence ${concurrency} ===`);
  console.log(JSON.stringify(summarize(latencies, wall, ok, ko), null, 2));
  console.log(`Duree totale : ${(wall / 1000).toFixed(1)}s`);
  if (ko) console.log('Erreurs :', errors);

  if (store) await store.close();
  gateway.close();
})().catch((e) => { console.error('Erreur bench-write :', e.message); process.exit(1); });