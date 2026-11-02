'use strict';
const { toPivot } = require('./engine/canonical-mapper');
const { canonicalStringify } = require('./engine/hasher');
const { validateEvent } = require('./engine/validator');

// Ancre un lot d'enveloppes normalisees, quelle que soit leur origine (JDBC, webhook, CSV)
async function anchorEnvelopes(envelopes, { gateway, store }) {
  let anchored = 0, rejected = 0, duplicate = 0, failed = 0;
  const results = [];

  for (const env of envelopes) {
    const pivot = toPivot(env);

    const { valid, errors } = validateEvent(pivot);
    if (!valid) { rejected++; results.push({ sigId: env.sigId, status: 'REJECTED', errors }); continue; }

    if (await store.isIndexed(env.sigId)) { duplicate++; results.push({ sigId: env.sigId, status: 'DUPLICATE' }); continue; }

    const { eventId, eventType, eventTimestamp } = pivot.eventMetadata;
    const payloadJson = canonicalStringify(pivot.payload);
    const sourceHash = pivot.integrityProof.sourceHash;

    try {
      const { txId } = await gateway.submit('createAttestedEvent', eventId, eventType, payloadJson, sourceHash);
      await store.recordAttestation({ eventId, sigId: env.sigId, eventType, sourceHash, blockchainTxId: txId, eventTimestamp });
      anchored++; results.push({ sigId: env.sigId, status: 'ANCHORED', eventId, txId });
    } catch (e) {
      failed++; results.push({ sigId: env.sigId, status: 'FAILED', error: e.message });
    }
  }
  return { total: envelopes.length, anchored, rejected, duplicate, failed, results };
}

module.exports = { anchorEnvelopes };