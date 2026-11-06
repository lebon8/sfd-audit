# Matrice RBAC et validation

## Matrice

| Transaction | `sfd_writer` | `sfd_reader` | `sfd_auditor` |
|---|---:|---:|---:|
| `createAttestedEvent` | Autorisé | Refusé | Refusé |
| `getAttestedEvent` | Refusé | Autorisé | Autorisé |
| `verifyEventIntegrity` | Refusé | Autorisé | Autorisé |
| `createAuditAlert` | Refusé | Refusé | Autorisé |
| `getAuditAlert` | Refusé | Refusé | Autorisé |
| `certifyReport` | Refusé | Refusé | Autorisé |
| `getReportCertification` | Refusé | Autorisé | Autorisé |

Le contrat exige `Org1MSP` puis lit `role` depuis l'identité du client Fabric. Un rôle fourni dans les arguments d'une transaction ou dans le corps HTTP ne remplace jamais l'identité.

## Client de test Gateway

`middleware/fabric-gateway/test-gateway.js` est séparé du client historique de production. Il reprend la configuration commune du peer/TLS/channel/chaincode et charge un seul certificat et une seule clé depuis chaque MSP configuré :

- `FABRIC_TEST_WRITER_MSP_DIR`
- `FABRIC_TEST_READER_MSP_DIR`
- `FABRIC_TEST_AUDITOR_MSP_DIR`

Le chargeur vérifie que chaque paire clé/certificat correspond avant de construire le signer. Les credentials ne sont ni copiés dans le dépôt ni affichés. Les trois MSP locaux présents dans l'environnement ont été vérifiés; aucun appel au peer n'a été fait pendant cette vérification.

Les services applicatifs utilisent `RoleGatewayClient` avec `FABRIC_IDENTITY_WRITER_MSP_DIR`, `FABRIC_IDENTITY_READER_MSP_DIR` et `FABRIC_IDENTITY_AUDITOR_MSP_DIR`. Ces variables doivent être ajoutées au `.env` local avant d'exécuter l'API, l'ingestion, l'audit, les rapports ou les benchmarks.

## Tests et preuves

| Contrôle | Statut | Preuve |
|---|---|---|
| Tests unitaires middleware historiques | **RÉUSSI** | Inclus dans `npm test -- --runInBand` |
| Matrice chaincode, MSP, rôle absent/inconnu, usurpation par argument | **SIMULÉ** | `middleware/tests/chaincode.test.js` |
| Autorisation des routes API pour un JWT writer valide | **SIMULÉ** | `middleware/tests/api-rbac.test.js`; les handlers de données ne sont pas appelés |
| Configuration API absente/faible et comparaison API key/JWT | **SIMULÉ** | `middleware/tests/auth.test.js` |
| Attribution de l'identité Gateway selon le rôle demandé | **SIMULÉ** | `middleware/tests/role-gateway.test.js` |
| Pannes Gateway distinctes des clés ledger absentes | **SIMULÉ** | `middleware/tests/gateway-errors.test.js` |
| Ordre d'ancrage Fabric puis index PostgreSQL et erreurs sur chaque étape | **SIMULÉ** | `middleware/tests/ingest-core.test.js` |
| Transactions RBAC writer/reader/auditor sur Fabric | **NON EXÉCUTÉ** | Les 3 tests de `fabric-rbac.integration.test.js` sont ignorés par défaut; aucun peer/orderer Fabric actif n'a été détecté |
| Tests PostgreSQL/Fabric, conflits MVCC et benchmark | **NON EXÉCUTÉ** | Les tests de performance et d'écriture toucheraient des données persistantes |
| Déploiement ou mise à niveau chaincode | **NON EXÉCUTÉ** | Accord explicite et plan de mise à niveau requis |

Au dernier passage, les tests automatisés disponibles ont donné **10 suites réussies, 56 tests réussis, 1 suite et 3 tests d'intégration réels ignorés**. Les vérifications `node --check`, `bash -n stack.sh` et `git diff --check` ont réussi.

## Exécution future des tests réels

La suite réelle crée une attestation, une alerte et une certification avec des identifiants UUID uniques. Elle ne doit être activée qu'après vérification de l'environnement cible et autorisation d'écrire sur son ledger.

```sh
cd middleware
RUN_FABRIC_RBAC_TESTS=1 \
FABRIC_TEST_WRITER_MSP_DIR=/chemin/local/writer/msp \
FABRIC_TEST_READER_MSP_DIR=/chemin/local/reader/msp \
FABRIC_TEST_AUDITOR_MSP_DIR=/chemin/local/auditor/msp \
npm test -- --runInBand tests/fabric-rbac.integration.test.js
```

La suite réelle couvre création/lecture/vérification d'événement, création/lecture d'alerte et certification/lecture de rapport. Le test exige les certificats et clés CA existants, et modifie le ledger pour les opérations autorisées.

## Blocages et limites

- La `SIG_API_KEY` locale a été remplacée par une clé aléatoire conforme au seuil de 32 octets. Sa valeur n'est pas reproduite ici; les clients SIG existants doivent être mis à jour.
- Le JWT n'est attribué qu'au rôle `sfd_auditor` par l'endpoint de token. Le mapping applicatif et les trois chemins MSP sont configurés; seuls les appels réels restent bloqués par l'absence de peer/orderer Fabric actif.
- La suite ne peut pas prouver l'acceptation/rejet par le peer d'un certificat non reconnu, d'un certificat sans attribut ou d'un MSP externe sans disposer d'identités de test correspondantes et d'un réseau actif.
- La cohérence entre PostgreSQL et Fabric reste éventuellement réconciliable, mais non atomique. Les résultats historiques de benchmarks ne sont pas réétiquetés comme des résultats de cette exécution.
