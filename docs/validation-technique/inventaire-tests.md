# Inventaire des tests et dépendances

État actualisé le 5 novembre 2026 à partir du dépôt et du dernier contrôle de disponibilité. Les tests exécutés et les tests simplement présents sont explicitement distingués.

## Dépendances au dernier contrôle

| Dépendance | Observation | Conséquence |
|---|---|---|
| Node.js / npm | Node.js v20.20.2; npm 11.17.0 | Environnement disponible pour Jest local |
| Fabric peer Org1 | conteneur arrêté (exit 255); `localhost:7051` refuse la connexion | Lectures/écritures Fabric bloquées |
| Fabric peer Org2 | conteneur arrêté (exit 255); `localhost:9051` refuse la connexion | Tests multi-peer/RBAC réel bloqués |
| Orderer | conteneur arrêté (exit 255); `localhost:7050` refuse la connexion | Transactions et commit bloqués |
| PostgreSQL | aucun endpoint local sur 5432 | Scénarios persistants et mesures de lecture bloqués |
| CA Org1 | conteneur actif au dernier contrôle | Ne signifie pas que peers, canal ou chaincode sont opérationnels |
| Identités MSP | chemins de rôle configurés, présence déjà vérifiée sans divulguer les credentials | Ne prouve pas l'acceptation d'une transaction par Fabric |

## Inventaire demandé

| Famille | Objectif | État actuel | Action nécessaire |
|---|---|---|---|
| Tests unitaires | Fonctions de hachage, mapping, règles, rapports, middleware et validations isolées | **RÉUSSI** — résultat existant: 10 suites/56 tests, aucun échec | Ne pas relancer sans changement de code; relancer la commande sûre ci-dessous après modification |
| Tests middleware | Auth HTTP, RBAC des routes, rôle JWT, erreurs Gateway et logique d'ingestion simulée | **RÉUSSI** — inclus dans les suites Jest précédentes; scénarios mockés/local HTTP | N'implique pas de preuve du backend connecté à Fabric/PostgreSQL |
| Tests PostgreSQL | Persistance, lecture des index, doublons, suppressions et cohérence | **BLOQUÉ** — endpoint PostgreSQL local indisponible; aucune DB de test isolée vérifiée | Mettre à disposition une DB explicitement isolée et autorisée; créer des tests d'intégration PG si requis |
| Tests Fabric | Transactions et évaluations du chaincode réel | **NON EXÉCUTÉ** — peers/orderer arrêtés | Démarrage réseau nécessite autorisation séparée; aucune action de démarrage n'est proposée ici |
| Tests RBAC | Autorisation chaincode et routes HTTP | **RÉUSSI (simulé)** — tests unitaires/middleware; suite réelle de 3 tests non lancée | Test réel seulement après démarrage autorisé et autorisation explicite des écritures ledger |
| Tests fonctionnels | Ingestion, lecture, intégrité, doublons, suppression, concurrence | **BLOQUÉ / NON EXÉCUTÉ** — aucun scénario E2E exécuté; aucune donnée réelle touchée | Harness isolé et dépendances disponibles requis; plan et commandes dans `commandes-tests-restants.md` |
| Tests de performance | 5 répétitions de 1000 écritures, lectures et vérifications | **BLOQUÉ** — aucun benchmark mesuré dans cette campagne | Réseau et DB isolés, charge et écritures explicitement autorisées |
| Tests de détection d'anomalies | Évaluation du moteur contre labels figés avant exécution | **RÉUSSI (synthétique seulement)** — 1000 événements, 50 anomalies; TP=50, FP=0, TN=950, FN=0 | Répéter sur jeux représentatifs indépendamment labellisés avant toute généralisation |
| Cohérence PostgreSQL/Fabric | Comparaison des données, hashes et txIds dans les deux systèmes | **BLOQUÉ** — les deux dépendances indisponibles | Interrogations en lecture sur environnement autorisé; aucun test de cohérence réel actuellement fourni |

## Tests Jest présents

| Fichier | Couverture observée | Nature / statut |
|---|---|---|
| `middleware/tests/hasher.test.js` | Sérialisation canonique et hashes | Unitaire; inclus dans le résultat 10/56 |
| `middleware/tests/mapper.test.js` | Mapping transaction/log | Unitaire; inclus |
| `middleware/tests/rules.test.js` | R1-R5 et jeu de règles réduit | Unitaire/synthétique; inclus |
| `middleware/tests/report.test.js` | PDF, hash et altération de buffer | Unitaire; inclus |
| `middleware/tests/chaincode.test.js` | RBAC chaincode, identité, MSP, validation, hashes | Chaincode simulé; inclus |
| `middleware/tests/auth.test.js` | API key, JWT et rôle HTTP | Unitaire; inclus |
| `middleware/tests/api-rbac.test.js` | Routes HTTP avec serveur local en mémoire du test | Test HTTP local, handlers protégés; inclus |
| `middleware/tests/role-gateway.test.js` | Choix du client Gateway selon rôle | Simulé; inclus |
| `middleware/tests/gateway-errors.test.js` | Classification erreurs Gateway | Simulé; inclus |
| `middleware/tests/ingest-core.test.js` | Ordre submit/index et erreurs injectées | Dépendances simulées; inclus |
| `middleware/tests/fabric-rbac.integration.test.js` | 3 scénarios créant événement/alerte/certification réels | Écriture ledger; exclu/non exécuté |

## Tests manquants ou incomplets

- Tests d'intégration PostgreSQL réels en base isolée.
- Test E2E liant une ligne métier persistée à une preuve Fabric committée.
- Test qui recharge la ligne PostgreSQL, recalcule son empreinte et démontre l'altération ou l'absence; la route actuelle reçoit un payload transmis par le client.
- Tests de doublons et de concurrence sur identifiant métier avec vérification d'idempotence.
- Test de suppression dans une DB jetable (sans altérer les preuves ledger).
- Rapprochement bidirectionnel PG/Fabric des événements, hashes et txIds.
- Benchmarks d'écriture, lecture et intégrité répétés; mesures ressources.
- Jeu d'évaluation d'audit réel/représentatif, étiqueté indépendamment.

Ne pas assimiler la présence d'un script de benchmark ou d'une suite opt-in à un résultat exécuté.
