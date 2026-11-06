
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

const args = process.argv.slice(2);

function getArg(name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 ? Number(args[index + 1]) : fallback;
}

const COUNT = getArg('--count', 100);
const CONCURRENCY = getArg('--concurrency', 10);

async function main() {
  const writer = new RoleGatewayClient('writer').connect();
  const reader = new RoleGatewayClient('reader').connect();

  let nextIndex = 0;
  let submitted = 0;
  let retrieved = 0;
  let sourceHashValid = 0;
  let blockchainHashValid = 0;
  let nativeValid = 0;
  let tamperDetected = 0;
  let errors = 0;

  const start = Date.now();

  async function worker() {
    while (true) {
      const index = nextIndex++;
      if (index >= COUNT) return;

      try {
        const event = makeEvent(index, 'INTEGRITY-VOLUME');

        // 1. Enregistrement dans Fabric
        const submission = await writer.submit(
          'createAttestedEvent',
          event.eventId,
          event.eventType,
          event.payloadJson,
          event.sourceHash
        );
        submitted++;

        // 2. Lecture de l'événement enregistré
        const storedRaw = await reader.evaluate(
          'getAttestedEvent',
          event.eventId
        );
        const stored = JSON.parse(storedRaw);
        retrieved++;

        // 3. Vérification du hash métier
        const payload = JSON.parse(stored.payload);
        if (hashObject(payload.data) === stored.sourceHash) {
          sourceHashValid++;
        }

        // 4. Vérification du hash de l'attestation
        const expectedHash = sha256Hex(
          `${stored.sourceHash}|${stored.payload}`
        );

        if (expectedHash === stored.blockchainHash) {
          blockchainHashValid++;
        }

        // 5. Vérification native par le chaincode
        const verification = JSON.parse(
          await reader.evaluate(
            'verifyEventIntegrity',
            event.eventId,
            stored.payload
          )
        );

        if (verification.integrityStatus === 'VALID') {
          nativeValid++;
        }

        // 6. Modification volontaire d'une copie locale
        const alteredPayload = JSON.parse(stored.payload);
        alteredPayload.data.amount.value += 1;

        const alteredJson = canonicalStringify(alteredPayload);

        const alteredVerification = JSON.parse(
          await reader.evaluate(
            'verifyEventIntegrity',
            event.eventId,
            alteredJson
          )
        );

        if (alteredVerification.integrityStatus === 'CORRUPTED') {
          tamperDetected++;
        }

      } catch (error) {
        errors++;
        console.error(
          `[ERREUR] Transaction ${index} : ${error.message}`
        );
      }
    }
  }

  try {
    console.log('\n=== TEST D’INTEGRITE A GRANDE ECHELLE ===');
    console.log(`Transactions : ${COUNT}`);
    console.log(`Concurrence  : ${CONCURRENCY}\n`);

    await Promise.all(
      Array.from(
        { length: CONCURRENCY },
        () => worker()
      )
    );

    const durationMs = Date.now() - start;
    const durationSeconds = durationMs / 1000;
    const throughput = COUNT / durationSeconds;

    console.log('\n========== RESULTATS ==========');
    console.log(`Transactions demandées       : ${COUNT}`);
    console.log(`Transactions enregistrées    : ${submitted}`);
    console.log(`Transactions récupérées      : ${retrieved}`);
    console.log(`Hash métier valides           : ${sourceHashValid}`);
    console.log(`Hash attestation valides      : ${blockchainHashValid}`);
    console.log(`Vérifications natives VALID   : ${nativeValid}`);
    console.log(`Altérations détectées         : ${tamperDetected}`);
    console.log(`Erreurs                       : ${errors}`);
    console.log('--------------------------------');
    console.log(`Durée totale                  : ${durationSeconds.toFixed(2)} s`);
    console.log(`Débit                         : ${throughput.toFixed(2)} événements/s`);

    const checks = COUNT * 5;
    const successfulChecks =
      sourceHashValid +
      blockchainHashValid +
      nativeValid +
      tamperDetected +
      (retrieved);

    console.log(
      `Taux global de vérifications : ${
        ((successfulChecks / checks) * 100).toFixed(2)
      } %`
    );

    console.log('================================\n');

    if (
      submitted !== COUNT ||
      retrieved !== COUNT ||
      sourceHashValid !== COUNT ||
      blockchainHashValid !== COUNT ||
      nativeValid !== COUNT ||
      tamperDetected !== COUNT ||
      errors > 0
    ) {
      process.exitCode = 1;
    }

  } catch (error) {
    console.error('Erreur générale :', error);
    process.exitCode = 1;
  } finally {
    writer.close();
    reader.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
