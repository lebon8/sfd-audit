# Architecture et exploitation

## Architecture

- **SIG / PostgreSQL** conserve les données métier et les index de corrélation hors chaîne.
- **Middleware Node.js** adapte les sources JDBC/webhook, normalise les enregistrements, calcule les empreintes, orchestre l'audit et génère les rapports.
- **Fabric Gateway** transmet les transactions au peer configuré par `FABRIC_TN`, `FABRIC_PEER_ENDPOINT` et `FABRIC_PEER_HOST_ALIAS`.
- **Chaincode `agnostictrace`** conserve les attestations, alertes et certifications de rapport; il vérifie le MSP et l'attribut X.509 `role`.

## Flux d'ingestion

1. Un adaptateur produit une enveloppe et `canonical-mapper.js` construit le pivot canonique.
2. `validator.js` valide le schéma; `hasher.js` calcule le hash SHA-256 du record source et sérialise le payload.
3. Le middleware soumet `createAttestedEvent` à Fabric. Le chaincode vérifie le rôle `sfd_writer`, valide l'événement et écrit son attestation.
4. Après le commit Fabric, `CorrelationStore.recordAttestation` écrit l'index PostgreSQL.

Les étapes 3 et 4 ne sont pas une transaction distribuée atomique. Un échec PostgreSQL après le commit Fabric peut laisser une attestation sans index; un échec Fabric n'écrit pas l'index. La réconciliation est manuelle et ne doit pas être remplacée par une réinitialisation du réseau ou de la base.

## Audit et rapports

Le moteur d'audit lit les événements indexés, récupère les attestations du ledger, applique les règles R1-R5, signe les alertes et soumet `createAuditAlert`. La certification d'un rapport PDF ancre uniquement le hash, pas le fichier.

Le chaincode stocke la chaîne de signature d'alerte, mais ne valide pas cette signature. La vérification cryptographique de la signature reste à ajouter si elle doit constituer une preuve d'authenticité opposable.

## Authentification et identités

- `SIG_API_KEY` et `JWT_SECRET` doivent être configurés avec au moins 32 octets. Aucun secret de repli n'est utilisé par l'API.
- L'endpoint `/api/v1/auth/token` n'émet que le rôle `sfd_auditor`; les autres routes vérifient les rôles présents dans le JWT signé.
- Les trois identités MSP locales ont des certificats et des clés correspondantes vérifiés. Les attributs `sfd_writer`, `sfd_reader` et `sfd_auditor` sont présents dans le texte X.509 vérifié.
- Les flux applicatifs utilisent `RoleGatewayClient` avec les répertoires MSP `FABRIC_IDENTITY_WRITER_MSP_DIR`, `FABRIC_IDENTITY_READER_MSP_DIR` et `FABRIC_IDENTITY_AUDITOR_MSP_DIR`. Le client historique `gateway.js` conserve l'identité `User1@org1.example.com` pour compatibilité, mais cette identité n'est pas utilisée par les flux applicatifs RBAC.
- Le certificat historique `User1` a été trouvé sans attribut correspondant aux trois rôles; il ne satisferait donc pas les contrôles du chaincode RBAC.
- Le helper distinct `test-gateway.js` utilise les variables `FABRIC_TEST_*_MSP_DIR` (ou les variables de service si les premières sont absentes). Il permet de tester les certificats CA sans faire dépendre les tests de l'identité historique.

## Configuration et démarrage

Les trois répertoires MSP de service sont configurés dans le `.env` local ignoré par Git. Une nouvelle `SIG_API_KEY` aléatoire de 32 octets a également été installée localement; les clients SIG existants doivent être mis à jour avec cette nouvelle clé, que le rapport ne reproduit pas. Ne jamais copier une clé privée dans le dépôt ou les journaux. Les valeurs PostgreSQL de l'exemple sont réservées au développement et doivent être remplacées pour tout déploiement.

`./stack.sh up` démarre uniquement PostgreSQL et l'API; il ne touche pas à Fabric et ne déploie pas de chaincode. `./stack.sh down` arrête uniquement les services locaux et conserve le volume PostgreSQL.

`./stack.sh seed` écrit des données de test et peut ancrer des transactions. `./stack.sh reset` est volontairement désactivée et ne fait rien, afin de protéger le ledger et le volume PostgreSQL.

## Tests

Depuis `middleware/` :

```sh
npm test -- --runInBand
```

Cette commande inclut les tests unitaires middleware, les tests simulés chaincode/RBAC, les tests des contrôles HTTP et la classification des erreurs Gateway. Les tests Fabric réels sont distincts et ne sont pas exécutés par défaut; voir [rbac-and-validation.md](./rbac-and-validation.md).

## Procédure de déploiement

Aucun déploiement n'a été exécuté. Avant toute mise à niveau, établir et faire approuver un plan comprenant le channel actif, la définition actuellement committée, le nom/version/sequence du chaincode, les organisations approbatrices, les MSP/certificats utilisés, les tests de retour arrière et la fenêtre d'impact. Vérifier les prérequis en lecture seule. Ne lancer la séquence de packaging/installation/approbation/commit qu'après approbation explicite; ne pas employer `network.sh down`, une remise à zéro, ni supprimer des volumes.

## Limites connues

- Fabric et PostgreSQL ne sont pas atomiques; l'index `sig_id` n'est pas unique.
- Le peer/orderer Fabric n'était pas actif lors des validations; la connectivité et l'autorisation réelles restent à établir.
- Les signatures des alertes ne sont pas vérifiées dans le chaincode.
- Les essais de concurrence, d'intégration PostgreSQL/Fabric et les benchmarks réels restent à exécuter sur un environnement autorisé et isolé.
