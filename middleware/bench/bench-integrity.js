
'use strict';

const path = require('path');

require('dotenv').config({
  path: path.resolve(__dirname, '../../.env')
});

const { RoleGatewayClient } = require('../fabric-gateway/role-gateway');
const { makeEvent } = require('./gen-events');
const {
  canonicalStringify,
  hashObject,
  sha256Hex
} = require('../engine/hasher');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

(async () => {
  const writer = new RoleGatewayClient('writer').connect();
  const reader = new RoleGatewayClient('reader').connect();

  let passed = 0;
  let failed = 0;

  function check(label, condition, details = '') {
    if (condition) {
      passed++;
      console.log(`[OK] ${label}`);
    } else {
      failed++;
      console.log(`[ECHEC] ${label}`);
    }

    if (details) console.log(`     ${details}`);
  }

  try {
    console.log('\n=== TEST D INTEGRITE DES TRANSACTIONS ===\n');

    // 1. Création et ancrage d'un événement de test
    const event = makeEvent(Date.now(), 'INTEGRITY');

    console.log('Event ID :', event.eventId);

    const submission = await writer.submit(
      'createAttestedEvent',
      event.eventId,
      event.eventType,
      event.payloadJson,
      event.sourceHash
    );

    console.log('Transaction Fabric :', submission.txId);

    // 2. Récupération depuis Fabric
    const storedRaw = await reader.evaluate(
      'getAttestedEvent',
      event.eventId
    );

    const stored = JSON.parse(storedRaw);
    const payload = JSON.parse(stored.payload);

    // 3. Vérification du hash métier
    const recalculatedSourceHash = hashObject(payload.data);

    check(
      'Hash métier identique',
      recalculatedSourceHash === stored.sourceHash,
      `Enregistre : ${stored.sourceHash}\n     Recalcule : ${recalculatedSourceHash}`
    );

    // 4. Vérification de l'empreinte de l'attestation
    const expectedBlockchainHash = sha256Hex(
      `${stored.sourceHash}|${stored.payload}`
    );

    check(
      'Hash de l attestation identique',
      expectedBlockchainHash === stored.blockchainHash,
      `Hash blockchain : ${stored.blockchainHash}`
    );

    // 5. Vérification par le chaincode
    const normalVerification = JSON.parse(
      await reader.evaluate(
        'verifyEventIntegrity',
        event.eventId,
        stored.payload
      )
    );

    check(
      'Vérification native Fabric : contenu intact',
      normalVerification.integrityStatus === 'VALID',
      `Statut : ${normalVerification.integrityStatus}`
    );

    // 6. Simulation d'une altération locale du contenu
    const alteredPayload = JSON.parse(stored.payload);

    alteredPayload.data.amount.value += 1;

    const alteredPayloadJson = canonicalStringify(alteredPayload);

    const alteredSourceHash = hashObject(alteredPayload.data);

    check(
      'Détection locale d une modification',
      alteredSourceHash !== stored.sourceHash,
      `Hash initial : ${stored.sourceHash}\n     Hash modifié : ${alteredSourceHash}`
    );

    // 7. Vérification de l'altération par le chaincode
    const alteredVerification = JSON.parse(
      await reader.evaluate(
        'verifyEventIntegrity',
        event.eventId,
        alteredPayloadJson
      )
    );

    check(
      'Détection de l altération par Fabric',
      alteredVerification.integrityStatus === 'CORRUPTED',
      `Statut : ${alteredVerification.integrityStatus}`
    );

    // 8. Vérification de la sérialisation canonique
    const reorderedPayload = {
      data: payload.data,
      action: payload.action,
      entityType: payload.entityType
    };

    const reorderedJson = canonicalStringify(reorderedPayload);

    check(
      'Ordre des propriétés sans effet',
      reorderedJson === stored.payload
    );

    console.log('\n=== BILAN ===');
    console.log('Tests réussis :', passed);
    console.log('Tests échoués :', failed);
    console.log('Total :', passed + failed);
    console.log(
      'Taux de réussite :',
      ((passed / (passed + failed)) * 100).toFixed(2) + '%'
    );

    console.log('\nEvent testé :', event.eventId);
    console.log('Transaction :', submission.txId);

    if (failed > 0) process.exitCode = 1;

  } catch (error) {
    console.error('\nErreur durant le test :', error.message);
    process.exitCode = 1;

  } finally {
    writer.close();
    reader.close();
  }

})().catch(error => {
  console.error('Erreur générale :', error.message);
  process.exit(1);
});
