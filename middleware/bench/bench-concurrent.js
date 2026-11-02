'use strict';
require('dotenv').config();
const { GatewayClient } = require('../fabric-gateway/gateway');
const { makeEvent } = require('./gen-events');
const { summarize, arg } = require('./stats');

// Un "producteur" = un SIG independant, avec sa propre connexion gateway
async function producer(id, perProducer, latencies, tally) {
  const gateway = new GatewayClient().connect();
  try {
    for (let i = 0; i < perProducer; i++) {
      const e = makeEvent(i, `SIG${id}`);
      const t0 = Date.now();
      try { await gateway.submit('createAttestedEvent', e.eventId, e.eventType, e.payloadJson, e.sourceHash);
            latencies.push(Date.now() - t0); tally.ok++; }
      catch (err) { tally.ko++; const k = (err.message || 'x').slice(0, 40); tally.err[k] = (tally.err[k] || 0) + 1; }
    }
  } finally { gateway.close(); }
}

(async () => {
  const producers = parseInt(arg('--producers', '5'), 10);
  const perProducer = parseInt(arg('--per', '200'), 10);

  const latencies = []; const tally = { ok: 0, ko: 0, err: {} };
  const wall0 = Date.now();
  await Promise.all(Array.from({ length: producers }, (_, i) => producer(i + 1, perProducer, latencies, tally)));
  const wall = Date.now() - wall0;

  console.log(`\n=== ${producers} SIG CONCURRENTS x ${perProducer} tx ===`);
  console.log(JSON.stringify(summarize(latencies, wall, tally.ok, tally.ko), null, 2));
  if (tally.ko) console.log('Erreurs :', tally.err); else console.log('Aucun conflit (cles uniques) ✓');
})().catch((e) => { console.error('Erreur bench-concurrent :', e.message); process.exit(1); });