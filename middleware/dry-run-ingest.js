'use strict';

require('dotenv').config();
const JDBCAdapter = require('./adapters/jdbc-adapter');
const { toPivot } = require('./engine/canonical-mapper');
const { canonicalStringify, sha256Hex } = require('./engine/hasher');

async function main() {
  const adapter = new JDBCAdapter();
  await adapter.connect();

  const envelopes = await adapter.consume();
  console.log(`Enregistrements non indexes consommes : ${envelopes.length}\n`);

  for (const env of envelopes.slice(0, 5)) {       // apercu des 5 premiers
    const pivot = toPivot(env);
    const payloadJson = canonicalStringify(pivot.payload);
    const sourceHash = pivot.integrityProof.sourceHash;
    const anchorPreview = sha256Hex(`${sourceHash}|${payloadJson}`);

    console.log('---');
    console.log('eventId    :', pivot.eventMetadata.eventId);
    console.log('eventType  :', pivot.eventMetadata.eventType);
    console.log('sigId      :', env.sigId);
    console.log('sourceHash :', sourceHash.slice(0, 16) + '...');
    console.log('payload    :', payloadJson.slice(0, 90) + '...');
    console.log('-> ancrera :', anchorPreview.slice(0, 16) + '...');
  }

  await adapter.disconnect();
}

main().catch((e) => { console.error('Erreur dry-run :', e.message); process.exit(1); });