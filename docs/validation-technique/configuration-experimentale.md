# Configuration et portée expérimentale

## Environnement observé

- Date de la campagne : 5 novembre 2026 (heure locale indiquée dans la demande : UTC+01).
- Node.js : `v20.20.2`; npm : `11.17.0`.
- Fabric CLI locale : peer `v2.5.15`.
- Images Docker des peers/orderer/CA étiquetées `latest`; leurs versions exactes ne sont pas certifiées par le tag.
- `ca_org1` était démarrée; `peer0.org1.example.com`, `peer0.org2.example.com` et `orderer.example.com` étaient arrêtés (exit 255).
- Les ports locaux 7051, 9051, 7050 et 5432 refusaient les connexions; 7054 (CA Org1) acceptait une connexion TCP.
- Le canal et le chaincode n'ont pas pu être interrogés. Des journaux historiques du 4 novembre mentionnaient `sfdchannel` et les blocs 0 à 4; ce n'est pas une preuve de l'état courant.
- Les trois chemins MSP de rôle et le certificat TLS du peer étaient configurés/présents. Pour chaque rôle, un fichier PEM et un fichier de keystore étaient présents; aucun contenu de clé ou certificat n'a été affiché ni lu dans cette vérification.
- Les variables de configuration API étaient présentes et respectaient le seuil de longueur; leurs valeurs ne sont pas reproduites.
- Le volume PostgreSQL existe dans Docker d'après l'inspection précédente, mais aucun service PostgreSQL n'était joignable. Les données n'ont pas été interrogées.

## Périmètre des tests

- Jest exécuté dans `middleware/` avec `RUN_FABRIC_RBAC_TESTS=0` et `tests/fabric-rbac.integration.test.js` exclu.
- Les tests unitaires/simulés n'ouvrent pas de connexion Fabric ou PostgreSQL.
- L'évaluation du moteur a utilisé exclusivement le CSV synthétique ci-joint, sans API, base de données, réseau Fabric ni écritures ledger.
- Les essais de bout en bout, doublons, concurrence, cohérence et performance ont été bloqués par l'indisponibilité des services et par l'absence de base isolée autorisée.

## Jeu synthétique d'audit

- Fichier : `dataset-audit.csv`, pré-étiqueté et conservé avant l'exécution de l'évaluateur.
- SHA-256 du CSV au moment de l'évaluation : `aa246e887058e49e15e3a0c2732fae0f6ab3b99c11903b195963970246e532db`.
- 1 000 événements : 950 normaux et 50 anomalies, dix événements par famille R1 à R5.
- Les règles d'étiquetage sont les seuils et conditions de `middleware/audit/rules-config.json` et des règles R1-R5. Les labels sont définis par `generate-audit-dataset.js`, avant `evaluate-audit-dataset.js`.
- Les valeurs synthétiques visent les conditions des règles. Le résultat parfait mesure ce jeu construit et ne constitue pas une estimation de performance en production.

## Reproduction sans Fabric ni PostgreSQL

Depuis la racine du dépôt :

```sh
node docs/validation-technique/generate-audit-dataset.js
sha256sum docs/validation-technique/dataset-audit.csv
node docs/validation-technique/evaluate-audit-dataset.js
cd middleware
RUN_FABRIC_RBAC_TESTS=0 npm test -- --runInBand --testPathIgnorePatterns=tests/fabric-rbac.integration.test.js
```

Le générateur réécrit le seul CSV de jeu synthétique sous `docs/validation-technique/`. Ne pas le confondre avec les tables métier.

## Mesures de ressources et performances

Aucune campagne de performance n'a été exécutée; aucun chiffre de CPU/RAM durant une charge Fabric/PostgreSQL n'est disponible. Les estimations historiques citées dans la mission ne sont pas de nouveaux résultats et ne sont pas intégrées dans les CSV mesurés.
