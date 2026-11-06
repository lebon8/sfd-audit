
'use strict';

const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../../.env')
});

const { RoleGatewayClient } = require('../fabric-gateway/role-gateway');
const { makeEvent } = require('./gen-events');

async function main() {
  const writer = new RoleGatewayClient('writer').connect();
  const reader = new RoleGatewayClient('reader').connect();

  try {
    console.log('\n=== TEST DE PREVENTION DES DOUBLONS ===\n');

    // Générer un événement unique
    const event = makeEvent(Date.now(), 'DUPLICATE-TEST');

    console.log('Event ID :', event.eventId);

    // Première soumission : elle doit réussir
    const first = await writer.submit(
      'createAttestedEvent',
      event.eventId,
      event.eventType,
      event.payloadJson,
      event.sourceHash
    );

    console.log('[OK] Première soumission acceptée');
    console.log('Transaction Fabric :', first.txId);

    // Deuxième soumission avec exactement le même identifiant
    let duplicateRejected = false;

    try {
      await writer.submit(
        'createAttestedEvent',
        event.eventId,
        event.eventType,
        event.payloadJson,
        event.sourceHash
      );

      console.log('[ECHEC] Le doublon a été accepté');

    } catch (error) {
      duplicateRejected = true;
      console.log('[OK] Deuxième soumission rejetée');
      console.log('Motif :', error.message);
      console.log('Code :', error.code);
      console.log('Détails :', error.details);
      console.log('Cause :', error.cause?.message);

      if (error.stack) {
        console.log('Stack :', error.stack);
      }
    }

    // Vérifier que l'événement initial existe toujours
    const storedRaw = await reader.evaluate(
      'getAttestedEvent',
      event.eventId
    );

    const stored = JSON.parse(storedRaw);

    const originalPreserved =
      stored.eventId === event.eventId &&
      stored.payload === event.payloadJson &&
      stored.sourceHash === event.sourceHash &&
      stored.txId === first.txId;

    if (originalPreserved) {
      console.log('[OK] Attestation originale préservée');
    } else {
      console.log('[ECHEC] L’attestation originale a changé');
    }

    console.log('\n========== BILAN ==========');
    console.log('Première soumission : ACCEPTÉE');
    console.log(
      'Deuxième soumission :',
      duplicateRejected ? 'REJETÉE' : 'ACCEPTÉE'
    );
    console.log(
      'Attestation originale :',
      originalPreserved ? 'PRÉSERVÉE' : 'ALTÉRÉE'
    );

    const success = duplicateRejected && originalPreserved;

    console.log(
      'Résultat global :',
      success ? 'SUCCÈS' : 'ÉCHEC'
    );

    if (!success) {
      process.exitCode = 1;
    }

  } catch (error) {
    console.error('\nErreur du test :', error.message);
    process.exitCode = 1;
  } finally {
    writer.close();
    reader.close();
  }
}

main().catch(error => {
  console.error('Erreur générale :', error.message);
  process.exit(1);
});
