
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

  const CONCURRENCY = 10;

  try {
    console.log('\n=== TEST DE DOUBLONS CONCURRENTS ===\n');

    const event = makeEvent(Date.now(), 'DUPLICATE-CONCURRENT');

    console.log('Event ID :', event.eventId);
    console.log(`Soumissions simultanées : ${CONCURRENCY}\n`);

    const start = Date.now();

    const attempts = await Promise.allSettled(
      Array.from({ length: CONCURRENCY }, (_, index) => {
        console.log(`[ENVOI] Requête ${index + 1}`);

        return writer.submit(
          'createAttestedEvent',
          event.eventId,
          event.eventType,
          event.payloadJson,
          event.sourceHash
        );
      })
    );

    const duration = Date.now() - start;

    const accepted = attempts.filter(
      result => result.status === 'fulfilled'
    );

    const rejected = attempts.filter(
      result => result.status === 'rejected'
    );

    console.log('\n========== RESULTATS DES SOUMISSIONS ==========');
    console.log('Soumissions acceptées :', accepted.length);
    console.log('Soumissions rejetées  :', rejected.length);
    console.log('Durée totale          :', duration, 'ms');

    rejected.forEach((result, index) => {
      const error = result.reason;

      console.log(`\n[REJET ${index + 1}]`);
      console.log('Message :', error.message);
      console.log('Code :', error.code);

      if (error.details) {
        console.log('Détails :', error.details);
      }
    });

    // Vérifier l'état final dans le registre
    const storedRaw = await reader.evaluate(
      'getAttestedEvent',
      event.eventId
    );

    const stored = JSON.parse(storedRaw);

    const originalPreserved =
      stored.eventId === event.eventId &&
      stored.payload === event.payloadJson &&
      stored.sourceHash === event.sourceHash;

    console.log('\n========== VERIFICATION DU REGISTRE ==========');
    console.log('Événement retrouvé :', !!stored.eventId);
    console.log('Identifiant correct :', stored.eventId === event.eventId);
    console.log('Contenu original préservé :', originalPreserved);
    console.log('Transaction enregistrée :', stored.txId);

    const success =
      accepted.length === 1 &&
      rejected.length === CONCURRENCY - 1 &&
      originalPreserved;

    console.log('\n========== BILAN ==========');
    console.log(
      'Protection contre les doublons concurrents :',
      success ? 'VALIDÉE' : 'À ANALYSER'
    );

    console.log('Résultat global :', success ? 'SUCCÈS' : 'ÉCHEC');

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
