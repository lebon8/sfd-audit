'use strict';

const JDBCAdapter = require('./adapters/jdbc-adapter');
const { toPivot } = require('./engine/canonical-mapper');
const { canonicalStringify } = require('./engine/hasher');
const { GatewayClient } = require('./fabric-gateway/gateway');
const { CorrelationStore } = require('./db/correlation');

async function runIngestCycle() {
  const adapter = new JDBCAdapter();
  const gateway = new GatewayClient();
  const store = new CorrelationStore();

  await adapter.connect();
  gateway.connect();

  const envelopes = await adapter.consume();
  let anchored = 0, failed = 0;

  for (const env of envelopes) {
    const pivot = toPivot(env);
    const { eventId, eventType, eventTimestamp } = pivot.eventMetadata;
    const payloadJson = canonicalStringify(pivot.payload);
    const sourceHash = pivot.integrityProof.sourceHash;

    try {
      const { txId } = await gateway.submit('createAttestedEvent', eventId, eventType, payloadJson, sourceHash);
      await store.recordAttestation({ eventId, sigId: env.sigId, eventType, sourceHash, blockchainTxId: txId, eventTimestamp });
      anchored++;
    } catch (e) {
      console.error(`Echec ancrage ${env.sigId} : ${e.message}`);
      failed++;
    }
  }

  await adapter.disconnect();
  await store.close();
  gateway.close();
  return { consumed: envelopes.length, anchored, failed };
}

module.exports = { runIngestCycle };