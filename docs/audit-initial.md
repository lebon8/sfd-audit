# Rapport d'audit technique initial

Date de l'audit : 2026-11-05

## Périmètre et précautions

L'audit porte sur `chaincode/agnostic-trace`, le middleware, l'API, les scripts, les configurations suivies dans Git, les tests et les benchmarks. Les valeurs de `.env` et les clés privées n'ont pas été affichées. Les modifications locales préexistantes ont été conservées.

Aucune commande de démarrage, d'arrêt, de réinitialisation, de déploiement, de benchmark ou d'écriture sur Fabric n'a été exécutée.

## Résumé

| Gravité | Constat |
|---|---|
| Critique | `stack.sh up` exécute `network.sh down`, puis recrée le channel et redéploie le chaincode. `stack.sh reset` supprime aussi le volume PostgreSQL. Ces commandes peuvent détruire ou remplacer des données et ne doivent pas être utilisées pour une simple mise en route. |
| Important | Le chaincode contrôle bien le MSP et l'attribut X.509 `role` au début des sept transactions sensibles. En revanche, le Gateway de production utilise toujours l'identité unique `User1@org1.example.com`; les services ne choisissent pas d'identité correspondant à l'opération. La compatibilité de cette identité avec les rôles requis n'est pas établie. |
| Important | L'API émet un JWT de rôle `auditor` à partir d'une clé API partagée et ses routes ne vérifient pas les rôles du JWT. `auth.js` fournit également des secrets de repli connus (`dev_secret`, `demo-sig-key-123`). Le rôle déclaré par le JWT n'est donc pas une frontière d'autorisation fiable. |
| Important | L'ingestion écrit d'abord sur Fabric puis dans PostgreSQL. Une panne entre les deux écritures peut créer une attestation orpheline; le contrôle de doublon PostgreSQL ne repose pas sur une contrainte unique `sig_id`, et l'ID blockchain est aléatoire lors de chaque conversion. Le système ne fournit pas de transaction distribuée atomique. |
| Important | Les tests existants ne couvrent que quatre suites middleware (16 tests). Il n'y a pas de tests chaincode/RBAC, API, Gateway ou intégration présents dans le projet. |
| Mineur | Plusieurs routes renvoient directement `e.message`; la route de lecture d'événement transforme toute erreur Gateway en `404`, y compris une indisponibilité du peer. Les périodes et plusieurs champs transactionnels ne sont pas strictement validés à la frontière HTTP/chaincode. |

## Vérifications réalisées

- État Git vérifié dans le dépôt imbriqué. Des modifications utilisateur existent dans le chaincode et les benchmarks, ainsi que des fichiers non suivis; ils n'ont pas été remplacés.
- Les noms de variables de `.env` ont été examinés sans en afficher les valeurs.
- Les trois répertoires MSP writer, reader et auditor existent localement. Le processus Docker consulté ne montre pas de peer ni d'orderer Fabric actif; les tests réels sur le ledger sont donc bloqués dans cet environnement.
- Syntaxe JavaScript : **RÉUSSI** (`node --check` sur les fichiers JS de chaincode, middleware et simulateur).
- Tests middleware existants : **RÉUSSI** — 4 suites, 16 tests.
- Tests chaincode, matrice RBAC réelle, API, intégration PostgreSQL/Fabric, concurrence et benchmarks : **NON EXÉCUTÉS**. Les benchmarks et les tests autorisés écrivent sur le ledger.
- Déploiement ou mise à niveau du chaincode : **NON EXÉCUTÉ**; cela exige un plan approuvé et une disponibilité réseau.

## Analyse technique

### Chaincode et RBAC

`agnosticTrace.js` applique `_requireRole` en première opération dans `createAttestedEvent`, `getAttestedEvent`, `verifyEventIntegrity`, `createAuditAlert`, `getAuditAlert`, `certifyReport` et `getReportCertification`. Le rôle est lu dans l'identité cliente, et non dans les arguments de transaction. Aucune autre transaction publique sensible n'a été identifiée dans le contrat.

Les contrôles autorisent exclusivement `Org1MSP`. La validation des arguments métier reste limitée : notamment, le hash source et le hash du rapport ne sont pas validés comme SHA-256 hexadécimal, et `relatedTxIdsJson` n'est pas vérifié comme tableau après désérialisation.

### Middleware, API et persistance

Les noms de transactions employés par le middleware correspondent aux méthodes du chaincode. Les requêtes PostgreSQL observées sont paramétrées. L'index de corrélation a `event_id` comme clé primaire mais aucune contrainte unique sur `sig_id`. L'écriture blockchain puis l'écriture PostgreSQL sont deux opérations distinctes.

La vérification HTTP ne transforme pas les claims en identité Fabric : le client Gateway de production reste fixé sur `User1`. Ainsi, un JWT valide ne fournit aucune preuve que la transaction sera signée par l'identité X.509 qui porte le rôle attendu par le chaincode.

### Scripts et risques d'exploitation

`stack.sh up` combine une extinction du réseau, la création du channel et un déploiement du chaincode. `stack.sh reset` supprime le volume PostgreSQL. Le script ne doit pas servir de commande de démarrage de routine tant que ces opérations ne sont pas séparées et explicitement protégées. Aucun de ces chemins n'a été exécuté.

## Plan d'exécution priorisé

1. Neutraliser les chemins de démarrage susceptibles d'arrêter le réseau ou de déployer le chaincode sans accord; retirer les conseils de récupération qui recommandent une réinitialisation destructive.
2. Créer un client Gateway de test distinct, sélectionnant writer/reader/auditor par MSP local, réutilisant les variables réseau/TLS existantes et vérifiant l'accord certificat-clé sans afficher les credentials.
3. Ajouter des tests unitaires simulés du chaincode et des tests d'autorisation réels opt-in avec des identifiants uniques. Ne pas exécuter les tests d'écriture réels sans réseau disponible et accord explicite.
4. Fermer les lacunes d'autorisation HTTP et de configuration par défaut, puis tester les cas token/API key et rôle.
5. Ajouter des tests d'intégration PostgreSQL/Fabric et d'intégrité/concurrence; les garder bloqués tant qu'ils nécessitent une écriture sur le réseau actif.
6. Documenter architecture, permissions, prérequis, commandes sûres et résultats avec leur statut exact. Les benchmarks ne seront relancés qu'après validation du périmètre et du réseau cible.
