# Rapport de validation technique — SFD Agnostic Trace

**Date de l'audit :** 5 novembre 2026  
**Périmètre :** audit statique du code, tests locaux non persistants et évaluation synthétique du moteur d'audit.  
**Protection des données :** aucun secret, mot de passe, certificat privé ni contenu de clé n'est reproduit.

Les nouveaux livrables détaillés sont dans [validation-technique/](./validation-technique/). Les fichiers de résultats et le présent rapport antérieurs à cette actualisation sont préservés sous [validation-technique/historique/2026-11-05-pre-finalisation/](./validation-technique/historique/2026-11-05-pre-finalisation/); les valeurs historiques n'ont pas été réécrites comme mesures nouvelles.

## A. Présentation et environnement

L'objectif est d'évaluer le prototype qui associe les données opérationnelles SIG/PostgreSQL, le middleware Node.js, les preuves du chaincode `agnostictrace` et le moteur d'audit. Les résultats distinguent les contrôles réellement exécutés des scénarios bloqués.

Environnement constaté :

- Node.js `v20.20.2`, npm `11.17.0`, peer CLI locale Fabric `v2.5.15`.
- Les conteneurs Docker utilisent les tags `latest`; la version exacte des images Fabric peer/orderer/CA n'a pas été vérifiée.
- `ca_org1` était active. Les deux peers et l'orderer étaient arrêtés (code de sortie 255); les ports 7051, 9051 et 7050 refusaient les connexions.
- Aucun conteneur PostgreSQL n'était actif/visible dans la liste ciblée et `localhost:5432` refusait les connexions.
- Les chemins MSP writer/reader/auditor et le certificat TLS du peer étaient présents; les valeurs `.env` et les clés n'ont pas été affichées. L'état et la version du canal/chaincode n'ont pas été interrogés.
- Les journaux du précédent audit montraient historiquement `sfdchannel` et des blocs jusqu'au bloc 4. Cela ne démontre ni l'état courant du canal, ni l'intégrité actuelle des volumes.

## B. Architecture technique réellement observée

### Diagramme global

Le diagramme source est dans [validation-technique/architecture.mmd](./validation-technique/architecture.mmd).

### Séquence d'enregistrement

La séquence source est dans [validation-technique/sequence-enregistrement.mmd](./validation-technique/sequence-enregistrement.mmd). Le flux JDBC réel lit les tables SIG existantes, calcule la preuve, commit sur Fabric, puis écrit l'index de corrélation PostgreSQL. Le webhook suit un chemin distinct : il reçoit un payload par l'API et ancre l'événement; il ne persiste pas l'opération métier dans les tables SIG.

### Stockage et exposition des données

`canonical-mapper.js` construit le payload transaction avec transactionId, type d'opération, montant/devise, identifiants membre/agent/agence, dates, description, canal et statut. Les logs incluent actorId, cible, adresse IP et détails. `ingest-core.js` sérialise le payload complet avec `canonicalStringify` puis passe cette chaîne à `createAttestedEvent`.

Le chaincode stocke dans l'état Fabric `eventId`, `eventType`, la chaîne complète `payload`, `sourceHash`, `blockchainHash`, horodatage et txId. La fonction de hash est SHA-256 de `sourceHash|payloadJson`. La signature d'alerte et les identifiants liés sont aussi stockés; la certification de rapport stocke seulement son hash et les périodes, pas le PDF.

**Pourquoi stocker actuellement toute la charge utile ?** Le moteur d'audit, les rapports et certaines lectures récupèrent les événements via `getAttestedEvent` et consomment `evt.payload` (par exemple `payload.data`). Le payload sur ledger permet donc à ces fonctions de reconstruire les événements sans relire la source opérationnelle. Ce choix simplifie l'audit/rapport autonome du ledger, mais il n'est pas indispensable au seul objectif d'intégrité : un identifiant corrélé, une empreinte et les métadonnées minimales suffiraient si les données métier restent disponibles dans PostgreSQL.

**Risque :** montants, identifiants et autres données sensibles sont répliqués et conservés dans le ledger, et exposés aux utilisateurs/organisations autorisés à lire l'état. Une donnée écrite en blockchain n'est pas effaçable par une correction applicative ultérieure. Aucun constat n'a été fait sur le contenu réel du ledger lors de cette campagne car le réseau était arrêté.

### Vérification actuelle et architecture cible

`verifyEventIntegrity` reçoit `recomputedPayloadJson`, le combine au `sourceHash` déjà stocké sur le ledger et compare au `blockchainHash`. La route `/api/v1/verify` accepte `{eventId,payload}` fourni par l'appelant, puis transmet le payload au chaincode. Elle ne recherche pas la ligne SIG actuelle dans PostgreSQL et ne recalcule pas l'empreinte de cette ligne. Ainsi, une modification postérieure des données PostgreSQL n'est pas automatiquement détectée par cet endpoint; un appelant qui fournit l'ancien payload peut toujours obtenir `VALID`.

Architecture cible recommandée, sans modification réalisée :

1. PostgreSQL reste la source des données opérationnelles.
2. Fabric conserve une référence stable (source + ID), un hash SHA-256 du contenu canonique, la version de canonicalisation/schéma et les métadonnées de preuve nécessaires.
3. Le service de vérification charge la ligne PostgreSQL par la référence, reconstruit exactement sa forme canonique et recalcule le hash; il compare celui-ci à l'empreinte ancrée. Une empreinte seule ne permet pas de reconstruire l'événement pour audit/rapport hors ligne.
4. Définir une stratégie de protection contre les attaques par dictionnaire sur données à faible entropie (par exemple choix explicite de champs, sel/commitment ou HMAC avec gestion de clé), sans ancrer de champs métier superflus.

Changements requis à documenter avant une évolution : adapter le modèle/arguments de `createAttestedEvent`, l'état retourné par `getAttestedEvent`, la logique de vérification et les services audit/rapport; versionner schéma et format canonique; changer les tests unitaires/intégration et les index PostgreSQL. Les anciens blocs conserveraient les payloads complets : le changement ne les effacerait pas. Il faudrait une lecture compatible v1/v2 et une procédure de migration gouvernée; aucun redéploiement ni changement du chaincode n'a été effectué.

### Échanges, authentification et identités

- Ingestion JDBC : `JDBCAdapter.consume()` sélectionne les lignes SIG non indexées; `toPivot` les normalise; `validateEvent` valide; `hashObject` calcule le SHA-256 de la ligne brute et `canonicalStringify` le payload; le Gateway writer appelle `createAttestedEvent`; après le commit, `CorrelationStore.recordAttestation` écrit `mw.attested_index`.
- Ingestion webhook : API protégée par clé API; l'adaptateur transforme le corps en enveloppes et appelle le même cœur d'ancrage.
- Audit : `runAuditCycle` lit l'index PostgreSQL, récupère les événements du ledger avec l'identité auditor, exécute R1-R5, signe les alertes avec Ed25519, soumet `createAuditAlert`, puis indexe l'alerte dans PostgreSQL. Le chaincode stocke la chaîne de signature mais ne la vérifie pas.
- Rapports : les événements sont relus du ledger; les statistiques agrègent des montants et identifiants; le PDF est écrit localement; seul son hash est soumis à `certifyReport`.
- Les rôles chaincode sont lus de l'attribut X.509 `role`, avec MSP strict `Org1MSP`. Les services utilisent un certificat dédié writer/reader/auditor, tous configurés dans le même MSP Org1. Org2 ne satisferait pas ce contrôle tel qu'implémenté.
- L'API exige une clé API et un secret JWT d'au moins 32 octets; les JWT utilisent HS256 et expirent après une heure. L'endpoint de token délivre uniquement `sfd_auditor` à un détenteur de la clé API.
- La frontière d'atomicité Fabric/PostgreSQL est réelle : un commit ledger peut réussir avant l'échec de l'index PostgreSQL; aucune transaction distribuée ni outbox de réconciliation n'est implémentée.

## C. Tests fonctionnels

| Test | Cas exécutés | Réussites | Échecs | Bloqués | Observations |
|---|---:|---:|---:|---:|---|
| Enregistrement | 0/20 | 0 | 0 | 20 | Fabric et PostgreSQL indisponibles |
| Lecture | 0/20 | 0 | 0 | 20 | Peer non joignable |
| Intégrité | 0/100 | 0 | 0 | 100 | Pas de DB isolée; vérification actuelle ne recharge pas PostgreSQL |
| Suppression | 0/10 | 0 | 0 | 10 | Aucune suppression effectuée; environnement isolé absent |
| Doublons | 0/10 | 0 | 0 | 10 | Non exécuté; voir défauts ci-dessous |
| Concurrence | 0/600 | 0 | 0 | 600 | Écritures persistantes interdites et réseau arrêté |
| Cohérence | 0/5 catégories | 0 | 0 | 5 | Peer/orderer/PostgreSQL indisponibles |

Détail des blocages dans [validation-technique/resultats-tests-fonctionnels.csv](./validation-technique/resultats-tests-fonctionnels.csv).

**Tests automatisés locaux exécutés :** 10 suites, 56 tests réussis, 0 échec. La suite réelle `fabric-rbac.integration.test.js` a été exclue et `RUN_FABRIC_RBAC_TESTS=0`; elle ferait des transactions ledger. Ces tests sont unitaires/simulés, pas une preuve d'intégration Fabric/PostgreSQL.

L'inventaire test par test et les dépendances sont dans [validation-technique/inventaire-tests.md](./validation-technique/inventaire-tests.md). Le CSV de scénarios d'intégration sépare maintenant le résultat attendu, le résultat observé et l'état : [resultats-tests-fonctionnels.csv](./validation-technique/resultats-tests-fonctionnels.csv). Aucune opération E2E n'a été exécutée.

### C.1. Résultats RBAC

La matrice complète `3 rôles × 7 fonctions` est documentée dans [resultats-tests-rbac.csv](./validation-technique/resultats-tests-rbac.csv). Les combinaisons exécutées dans `chaincode.test.js` sont réussies **dans le chaincode simulé**. Les contrôles HTTP/API sont testés localement, sans Fabric. Cela n'est pas un test de certificat CA réellement accepté/refusé par un peer. La suite d'intégration réelle compte trois tests qui écrivent sur le ledger; elle n'a pas été lancée.

| Surface | Résultat exécuté | Limite |
|---|---|---|
| RBAC chaincode | Matrice simulée réussie; MSP incorrect, rôle absent/inconnu refusés par simulation | Pas de vérification via peer réel |
| RBAC API | Huit routes refusent un JWT writer dans un serveur local de test; route de token émet `sfd_auditor` même si le client demande writer | Requêtes de test HTTP locales, pas d'appel métier à Fabric/PostgreSQL |
| Identifiants/API | Tests unitaires de clé API/JWT valides, manquants, faibles et invalides | Secrets de test uniquement; pas de test déploiement |
| RBAC Fabric réel | Non exécuté | Peer/orderer arrêtés et écritures persistantes requièrent autorisation explicite |

## D. Tests de performance

Aucun des cinq essais d'écriture, de lecture ou de vérification d'intégrité (1 000 événements chacun) n'a été lancé. Les ports Fabric étaient fermés et aucun PostgreSQL n'était joignable. Il n'y a donc pas de débit, latence, CPU ou RAM de charge mesurés dans cette campagne. Les estimations historiques citées dans la mission (dont 122,58 tx/s) ne sont pas reproduites ni utilisées comme nouvelles mesures.

Les 15 lignes de répétition et trois lignes de synthèse bloquées, sans valeurs fictives, figurent dans [validation-technique/resultats-performance.csv](./validation-technique/resultats-performance.csv). Moyenne, médiane, écart-type, minimum et maximum ne sont pas calculables sans essais. Les scripts benchmark existants sont des outils qui écrivent dans Fabric pour les scénarios écriture/intégrité; leur présence ne constitue pas un résultat.

## E. Évaluation du moteur d'audit

Le fichier [validation-technique/dataset-audit.csv](./validation-technique/dataset-audit.csv) a été construit et sauvegardé avant d'appeler le moteur. Son SHA-256 avant évaluation était `aa246e887058e49e15e3a0c2732fae0f6ab3b99c11903b195963970246e532db`. Il comprend 1 000 transactions synthétiques, 950 normales et 50 anomalies, avec 10 événements labellisés dans chacune des familles R1 à R5.

Définitions préalables alignées sur la configuration et le code actuels :

- **R1** : deux dépôts de même montant pour un membre à moins de 300 secondes (5 paires, 10 événements).
- **R2** : montant strictement supérieur à 1 000 000 (10 événements).
- **R3** : date locale hors de l'intervalle [08:00,17:00[ (10 événements).
- **R4** : flux net absolu par membre supérieur à 2 000 000; groupes de dépôts distincts et sous le seuil unitaire R2 (10 événements).
- **R5** : plus de 5 transactions d'un même agent dans une heure sur plusieurs membres (10 événements).

Les 950 événements normaux ont des membres/agents distincts, montants sous le seuil, heure de journée et aucun motif R1/R4/R5. Labels et identifiants sont enregistrés avant l'évaluation. Les règles évaluées sont celles chargées depuis `middleware/audit/rules-config.json`; les alertes et identifiants détectés sont dans [validation-technique/resultats-audit.csv](./validation-technique/resultats-audit.csv).

| Anomalie étiquetée avant l'évaluation | Injectée | Détectée | Non détectée | Règle |
|---|---:|---:|---:|---|
| Dépôt double (R1) | 10 | 10 | 0 | R1 |
| Montant au-dessus du seuil (R2) | 10 | 10 | 0 | R2 |
| Opération hors horaires (R3) | 10 | 10 | 0 | R3 |
| Flux net par membre (R4) | 10 | 10 | 0 | R4 |
| Agent multi-comptes (R5) | 10 | 10 | 0 | R5 |

| Matrice événementielle | Détecté anomalie | Non détecté |
|---|---:|---:|
| Anomalie injectée | VP = 50 | FN = 0 |
| Événement normal | FP = 0 | VN = 950 |

Précision = 1, rappel = 1, F1 = 1; [matrice-confusion.csv](./validation-technique/matrice-confusion.csv) conserve les chiffres comme une ligne cohérente VP/FP/VN/FN. Le moteur a émis 29 alertes; une alerte peut concerner plusieurs événements (R1/R4/R5), ce qui explique que le nombre d'alertes ne soit pas le nombre d'événements positifs.

**Limite de validité :** le jeu synthétique est volontairement construit pour exercer les cinq règles et n'est pas un échantillon représentatif ni un jeu indépendant métier. Le score parfait n'est pas une estimation de précision/rappel en production. R4 est explicitement un proxy de flux net, pas une vérification d'un solde réel; R3 dépend du fuseau local du processus; R2 ne filtre pas effectivement la devise configurée.

## F. Anomalies et recommandations

| Gravité | Catégorie | Constat et preuve | Recommandation minimale |
|---|---|---|---|
| Élevée | Architecture / confidentialité | `payloadJson` complet est persisté comme `event.payload`; le mapper inclut données financières et identifiants. | Concevoir une nouvelle version qui ancre référence + hash + version/métadonnées minimales; maintenir la compatibilité de lecture historique. |
| Élevée | Intégrité fonctionnelle | `/api/v1/verify` transmet le payload de l'appelant au chaincode et ne recharge pas la ligne métier; la détection d'une modification PostgreSQL n'est pas démontrée. | Résoudre la référence dans une source de test/production autorisée, recalculer la forme canonique côté service et comparer le hash ancré. |
| Élevée | Cohérence / idempotence | `eventId` est généré aléatoirement; la protection ledger vérifie cet `eventId`, tandis que `sig_id` n'est pas unique dans le schéma et l'indexation est après commit. Les soumissions concurrentes du même identifiant source peuvent créer plusieurs événements. | Clé d'idempotence stable et namespacée; contrainte unique adaptée sur l'identifiant source; réservation/outbox et reprise/réconciliation. |
| Moyenne | Audit cryptographique | Une signature d'alerte Ed25519 est stockée, mais le chaincode ne la vérifie pas; les clés sont créées automatiquement localement par le middleware. | Gérer les clés selon politique explicite, restreindre leurs permissions et vérifier la signature avec une clé publique de confiance avant de la considérer comme preuve. |
| Moyenne | Exactitude des règles | R2 porte un paramètre `currency` mais ne le teste pas; R3 s'appuie sur le fuseau local; R4 est un proxy, malgré son nom de mismatch de solde. | Tester et documenter les unités/devise/fuseaux; renommer R4 ou l'alimenter par des soldes de référence réels. |
| Moyenne | Configuration | `CorrelationStore` et `JDBCAdapter` contiennent un identifiant/mot de passe de secours codé en dur pour PostgreSQL. | Supprimer les identifiants par défaut et échouer explicitement si la configuration requise est absente. |
| Moyenne | Résilience | Commit Fabric puis écriture PostgreSQL séparés; aucune atomie, et la réconciliation est manuelle. | Outbox durable/retry idempotent et outil de rapprochement non destructif avec journalisation des orphelins. |

Aucune correction de chaincode, de configuration ou de comportement n'a été effectuée dans cette campagne; les seuls ajouts sont les fichiers de rapport, dataset et scripts de preuve demandés.

## G. Limites

- Pas de réseau Fabric actif : transactions, lectures, membership/canal, policy et définition du chaincode non vérifiés.
- Pas de PostgreSQL joignable ni de base isolée : tests opérationnels d'intégrité, suppression, doublons, concurrence et cohérence non réalisés.
- Les volumes ledger n'ont pas été lus dans cette campagne; le contenu des blocs et l'existence actuelle des fichiers n'ont pas été vérifiés.
- Images Docker `latest` : versions exactes peer/orderer/CA non établies.
- Pas de benchmark reproductible ni mesure CPU/RAM sous charge.
- Jeu d'audit synthétique de taille fixe et construit pour les règles; pas de validation externe/aveugle.
- Les chemins/certificats ont été vérifiés par présence/count uniquement ici; aucune transaction d'identité réelle.
- Une migration du modèle de payload n'efface pas les données historiques déjà écrites dans le ledger.

## H. Conclusion et bilan

1. **Tests réalisés :** 10 suites Jest locales (56 tests) et évaluation synthétique de 1 000 événements.
2. **Tests réussis :** les 56 assertions unitaires/simulées; moteur synthétique : 50/50 anomalies détectées, 0/950 faux positifs.
3. **Tests échoués :** aucun test exécuté n'a échoué.
4. **Tests bloqués :** les sept scénarios de bout en bout et les dix essais de performance, faute de réseau/DB disponibles et d'isolation autorisée.
5. **Défauts corrigés :** aucun défaut applicatif corrigé.
6. **Défauts restant à traiter :** exposition du payload, vérification non liée à PostgreSQL, idempotence/doublons, signature d'alerte non vérifiée, paramètres de règles, identifiants DB de secours et absence d'outbox.
7. **Fichiers générés :** rapport, inventaire de tests, commandes restantes, résultats RBAC, deux diagrammes Mermaid, dataset pré-étiqueté, scripts de génération/évaluation et CSV fonctionnel, performance, audit et matrice. L'historique antérieur est archivé.
8. **Reproduction sans réseau :** commandes locales dans [configuration-experimentale.md](./validation-technique/configuration-experimentale.md); intégrations risquées et prérequis dans [commandes-tests-restants.md](./validation-technique/commandes-tests-restants.md).
9. **État réel :** middleware et tests simulés; Fabric configuré mais peers/orderer arrêtés; PostgreSQL non joignable. Le fonctionnement intégré n'est pas démontré.
10. **Confiance :** élevée pour les assertions locales précédemment exécutées et le calcul sur le dataset figé; faible pour leur généralisation; nulle pour les comportements d'intégration/performance non exécutés.

Le prochain palier de validation exige une base PostgreSQL isolée et un réseau Fabric actif vérifié. Aucun démarrage, écriture ledger, modification de données, changement de chaincode ou redéploiement n'est autorisé par ce rapport.
