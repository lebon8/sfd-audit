# Commandes et prérequis des tests restants

Les services ne sont pas démarrés par ces instructions. Ne pas exécuter de commande de démarrage/redémarrage, `network.sh down`, suppression, reset ou déploiement. Les commandes qui écrivent dans Fabric sont marquées et nécessitent votre autorisation explicite au moment de leur exécution.

## 1. Tests locaux sans dépendances persistantes

Dernier résultat connu : 10 suites/56 tests réussis. Il n'est pas nécessaire de les relancer sans changement de code. Après une modification applicative, depuis `middleware/` :

```bash
RUN_FABRIC_RBAC_TESTS=0 npm test -- --runInBand --testPathIgnorePatterns=tests/fabric-rbac.integration.test.js
```

Cette commande exclut explicitement la suite qui écrit dans le ledger.

Réévaluation synthétique déjà exécutée; ces commandes réécrivent le CSV du dataset synthétique et le CSV de résultats d'audit. Préserver une copie si le jeu ou les sorties doivent rester immuables :

```bash
cd /home/dorian/projets/sfd/sfd-agnostic-trace
node docs/validation-technique/generate-audit-dataset.js
sha256sum docs/validation-technique/dataset-audit.csv
node docs/validation-technique/evaluate-audit-dataset.js
```

## 2. Prérequis avant toute intégration réelle

1. Obtenir l'autorisation distincte de démarrer les services Fabric/PostgreSQL; vérifier leur santé, le canal `sfdchannel` et la définition déjà installée, sans reset ni redeploy.
2. Fournir une base PostgreSQL jetable, avec configuration isolée du SIG réel. Vérifier la cible sans afficher les credentials et confirmer que sa base n'est pas une base métier.
3. Vérifier que les identités writer/reader/auditor existantes sont configurées; ne créer ni régénérer certificat/clé dans le cadre de ce plan.
4. Préfixer les identifiants expérimentaux. La suite RBAC intégrée crée des événements, alertes et certifications dans le ledger : il n'existe pas de rollback des transactions committées.
5. Pour supprimer des lignes de test PostgreSQL, obtenir une autorisation séparée après preuve d'isolation; ne jamais exécuter le test sur les données SIG réelles.

Contrôle Fabric en lecture seule, une fois que l'opérateur a démarré le réseau et chargé l'environnement CLI Org1 :

```bash
peer channel list
peer channel getinfo -c sfdchannel
```

Ces commandes ne valident pas à elles seules la disponibilité de l'endorsement chaincode. Elles ne doivent être lancées que depuis un environnement CLI correctement configuré; aucune valeur secrète ne doit être imprimée.

## 3. RBAC réel — écritures ledger (AUTORISATION EXPLICITE REQUISE)

Depuis `middleware/`, seulement après confirmation de l'environnement et autorisation explicite d'ajouter les fixtures de test au ledger :

```bash
RUN_FABRIC_RBAC_TESTS=1 npm test -- --runInBand tests/fabric-rbac.integration.test.js
```

Ce test crée un événement, une alerte et une certification avec des suffixes UUID; les refus RBAC sont aussi soumis au peer. Même avec des identifiants uniques, ces écritures sont persistantes et ne sont pas automatiquement supprimées.

## 4. Benchmarks — écritures Fabric (AUTORISATION EXPLICITE REQUISE)

Les commandes suivantes ajoutent des transactions au ledger. N'exécuter qu'après autorisation explicite, sur le réseau et l'environnement de test approuvés. `--index` écrit également des lignes de corrélation dans PostgreSQL.

Depuis la racine du dépôt, un essai 1000 écritures à concurrence 50 avec index PostgreSQL :

```bash
node middleware/bench/bench-write.js --count 1000 --concurrency 50 --index
```

Répéter dans cinq exécutions indépendantes; chacune écrit de nouvelles transactions Fabric. Ne pas lancer une boucle automatique avant validation de la capacité et de la politique de charge. Pour les scénarios 100/concurrence 10 et 500/concurrence 25, les scripts existants n'ont pas de garde d'environnement isolé :

```bash
node middleware/bench/bench-concurrent.js --producers 10 --per 10
node middleware/bench/bench-concurrent.js --producers 25 --per 20
```

Ces scénarios écrivent 100 et 500 événements respectivement. Ce sont des producteurs Gateway indépendants, pas des tests PostgreSQL atomiques.

## 5. Benchmarks — lectures

Le benchmark lit des lignes `mw.attested_index`, puis interroge le peer. Les lignes doivent appartenir uniquement au jeu de benchmark autorisé. Il n'écrit pas dans le ledger, mais dépend de PostgreSQL et du peer.

```bash
node middleware/bench/bench-read.js --count 1000 --concurrency 50
```

Pour cinq essais, employer cinq sélections contrôlées ou confirmer que les 1000 mêmes enregistrements sont destinés à des lectures répétées. Le script ne fournit pas CPU/RAM, écart-type, minimum ou une médiane indépendante par répétition; consigner ces métriques séparément, sans inférer de valeurs.

## 6. Benchmark — intégrité (AUTORISATION EXPLICITE REQUISE)

`bench-integrity-volume.js` crée un événement Fabric par élément, lit la preuve et compare hashes normaux/altérés localement. `--count 1000` écrit 1000 événements par invocation :

```bash
node middleware/bench/bench-integrity-volume.js --count 1000 --concurrency 10
```

Chaque répétition est persistante et ajoute 1000 événements; cinq répétitions nécessitent donc une autorisation explicite couvrant 5000 écritures et un contrôle de charge.

## 7. Scénarios fonctionnels non couverts par un harness existant

Il n'existe pas de commande E2E dédiée couvrant les cas métier d'enregistrement PostgreSQL/Fabric, intégrité recalculée depuis PostgreSQL, absence/suppression, dix scénarios doublons et rapprochement bidirectionnel. Ne pas prétendre que les commandes de benchmark couvrent ces scénarios. Ils requièrent un harness ajouté après proposition/revue des changements, un stockage isolé vérifié et des données synthétiques préfixées.

Les routes API d'ingestion sont également des écritures ledger; leur invocation nécessite la même autorisation explicite. Aucun `curl` d'écriture n'est fourni ici pour éviter de poster par inadvertance vers une API configurée sur un environnement réel.

## 8. Résultats à conserver

- N'enregistrer que les sorties réellement obtenues et horodater les essais.
- Ne pas remplacer les fichiers historiques dans `historique/2026-11-05-pre-finalisation/`.
- Les CSV actuels ont une ligne BLOQUÉE par essai et champs de mesures vides; remplir uniquement après exécution réelle.
- Ne jamais écrire tokens, clés, mots de passe, certificats ou variables d'environnement dans les logs/rapport.
