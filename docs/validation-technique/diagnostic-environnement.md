# Diagnostic technique des dépendances Fabric et PostgreSQL

**Projet :** SFD Agnostic Trace  
**Réseau Fabric :** `fabric_test`  
**Canal :** `sfdchannel`  
**Date des vérifications :** 5 novembre 2026  
**Périmètre :** inspections Docker, journaux système existants, ports TCP et fichiers de configuration; aucune action de démarrage ou d'écriture.

## Résumé exécutif

- Les peers Org1 et Org2 ainsi que l'orderer sont arrêtés avec le code 255, `OOMKilled=false` et une politique de redémarrage Docker `no`. Leurs horodatages d'arrêt sont distants de moins de 3 ms.
- Le noyau journalise un démarrage/remontage des systèmes de fichiers à 22:55:55 UTC; Docker traite des sandbox périmées vers 22:56:08-09 UTC. Cette proximité rend un redémarrage de l'hôte probable, sans prouver comment ni pourquoi il a eu lieu.
- Les ports Fabric 7050, 7051 et 9051, ainsi que PostgreSQL 5432, refusent les connexions locales. Le port CA 7054 répond.
- Aucun conteneur PostgreSQL `sfd-postgres` n'est présent. Le volume PostgreSQL existant est `sfd-agnostic-trace_sig-pgdata`, alors que le Compose actuel déclare le volume logique `sfd_pgdata`. Le volume normalement attendu par ce Compose sous le projet `sfd-agnostic-trace` (`sfd-agnostic-trace_sfd_pgdata`) est absent. Le volume existant contient une utilisation Docker rapportée de 71,51 MB, mais son contenu n'a pas été lu.
- Aucun diagnostic n'a établi une cause applicative précise de l'arrêt simultané, ni vérifié l'intégrité des données. Les journaux du noyau consultés ne montrent aucun marqueur OOM ou erreur d'E/S dans la fenêtre filtrée.

**Conclusion :** les tests réels dépendant de Fabric et de PostgreSQL sont actuellement bloqués. Ne pas relancer PostgreSQL avec le Compose actuel avant d'avoir confirmé quel volume porte les données à conserver.

## 1. Méthodes et sécurité

Les vérifications ont été limitées aux commandes de lecture suivantes :

- `docker ps -a` et `docker inspect` des conteneurs ciblés; seules les propriétés d'état, de montage, réseau et redémarrage ont été extraites. Les variables d'environnement n'ont pas été affichées.
- `docker volume inspect`, `docker volume ls` et `docker system df -v`.
- `docker compose -f .../docker-compose.yml -p sfd-agnostic-trace ps -a`.
- `docker events --since '2026-11-04T22:50:00Z' --until '2026-11-04T23:10:00Z' --filter type=container`.
- `journalctl` sur Docker et le noyau dans la fenêtre du 4 novembre 2026, 22:45-23:10 UTC.
- `docker logs --timestamps --tail 200` sur les trois conteneurs Fabric; la nouvelle lecture a rendu zéro ligne.
- Tentatives TCP locales vers 7050, 7051, 9051, 5432 et 7054.

Aucun conteneur ou service n'a été démarré, arrêté, créé ou redémarré. Aucun volume, fichier, certificat, MSP ou configuration n'a été modifié. Aucune transaction Fabric n'a été soumise. Aucun secret ni contenu de `.env` n'est reproduit.

## 2. État observé des dépendances

| Composant | État observé | Preuve |
|---|---|---|
| Peer Org1 | `exited`, code 255, OOM false, redémarrages 0, politique `no` | `docker inspect peer0.org1.example.com` |
| Peer Org2 | `exited`, code 255, OOM false, redémarrages 0, politique `no` | `docker inspect peer0.org2.example.com` |
| Orderer | `exited`, code 255, OOM false, redémarrages 0, politique `no` | `docker inspect orderer.example.com` |
| CA Org1 | `running`; port hôte 7054 publié | `docker ps -a`, `docker inspect ca_org1`, connexion TCP à 7054 |
| PostgreSQL | Conteneur `sfd-postgres` absent; aucun service dans `docker compose ps -a` | `docker inspect sfd-postgres`, `docker compose ... ps -a` |
| CouchDB | Aucun conteneur CouchDB identifié dans `docker ps -a` | Inventaire des conteneurs |
| Réseau Fabric | `fabric_test` présent; peers, orderer et CA configurés/inspectés sur ce réseau | `docker inspect` des conteneurs |

### Horodatages des conteneurs Fabric

| Conteneur | Démarré (UTC) | Arrêté (UTC) |
|---|---|---|
| `peer0.org1.example.com` | 2026-11-04 10:49:03.918 | 2026-11-04 22:56:07.406 |
| `peer0.org2.example.com` | 2026-11-04 10:49:03.913 | 2026-11-04 22:56:07.409 |
| `orderer.example.com` | 2026-11-04 10:49:03.932 | 2026-11-04 22:56:07.406 |

Les trois conteneurs ont donc des heures d'arrêt quasi identiques. Cette corrélation n'identifie pas à elle seule le processus qui les a arrêtés.

## 3. Analyse de l'arrêt Fabric et des journaux

### Éléments observés

1. `docker inspect` rapporte `ExitCode=255`, `OOMKilled=false` et `RestartPolicy=no` pour les trois conteneurs.
2. `journalctl -k --since '2026-11-04 22:45:00 UTC' --until '2026-11-04 23:10:00 UTC'` montre notamment, à 23:55:55 heure locale (UTC+1), un montage du système de fichiers racine en lecture seule suivi d'un remontage en lecture-écriture. C'est cohérent avec une séquence de démarrage du système à 22:55:55 UTC.
3. Dans la même fenêtre, `journalctl -u docker.service ...` rapporte à 23:56:08-09 heure locale des suppressions de sandbox périmées, des erreurs de suppression d'entrées d'hôtes/sandbox et des avertissements d'opération atomique Docker, puis `Loading containers: done.` Ces lignes ne nomment pas les trois conteneurs Fabric.
4. Le filtre noyau pour OOM, erreurs d'E/S, erreurs EXT4/XFS et erreurs overlay retourne zéro ligne. Cela ne couvre que les termes et la fenêtre filtrés.
5. `docker events` pour la fenêtre UTC demandée n'a retourné aucun événement. Cela ne signifie pas nécessairement qu'aucun événement n'a eu lieu : l'API d'événements Docker ne garantit pas la conservation d'un historique ancien.
6. La nouvelle commande `docker logs --timestamps --tail 200` a retourné zéro ligne pour chacun des trois conteneurs, malgré le driver `json-file` indiqué par Docker. Dans l'audit précédent, des journaux historiques avaient montré des commits peer jusqu'au bloc 4 et une écriture du bloc 4 par l'orderer; des erreurs TLS `EOF` étaient également visibles le 5 novembre. Ces traces établissent une activité passée, pas la cause de l'arrêt ni l'état actuel du ledger.

### Diagnostic et limites

L'hypothèse la mieux étayée est un redémarrage de l'hôte vers 22:55:55 UTC, suivi du traitement des conteneurs par Docker; leur politique `no` explique pourquoi ils ne sont pas repartis automatiquement. **Confiance : moyenne à élevée** pour le contexte de redémarrage, car les traces système sont temporellement proches; **faible** pour la cause racine de l'arrêt des conteneurs, car aucune trace ne les associe explicitement à une commande ou à une défaillance précise.

Les éléments disponibles ne permettent pas de départager une intervention planifiée, un arrêt/redémarrage manuel, une panne d'alimentation ou une autre cause de redémarrage. `OOMKilled=false` exclut seulement le signalement OOM par Docker pour ces conteneurs, pas toute forme de pression mémoire du système.

## 4. Ports et cohérence des endpoints

| Port local | Usage attendu | Résultat TCP |
|---:|---|---|
| 7050 | Orderer | `Connection refused` |
| 7051 | Peer Org1 | `Connection refused` |
| 9051 | Peer Org2 | `Connection refused` |
| 5432 | PostgreSQL | `Connection refused` |
| 7054 | CA Org1 | Connexion établie |

Les résultats proviennent de connexions à `127.0.0.1` avec un délai d'une seconde. Ils décrivent la disponibilité au moment du test, pas une indisponibilité permanente.

Le Compose Fabric définit le réseau Docker `fabric_test`, les noms DNS des peers/orderer et les ports publiés 7050, 7051 et 9051. Le middleware [network.js](../../middleware/fabric-gateway/network.js) utilise par défaut `localhost:7051` et un alias TLS `peer0.org1.example.com`. Le script [stack.sh](../../stack.sh) lance l'API Node.js sur l'hôte, et non dans le Compose PostgreSQL; `localhost:7051` est donc cohérent pour le mode local documenté. Aucun indice ne démontre que l'API est actuellement lancée. Si elle était exécutée dans un conteneur, `localhost` ne désignerait pas le peer et cet endpoint devrait être revu.

Le Compose applicatif [docker-compose.yml](../../docker-compose.yml) définit le service PostgreSQL `postgres`, le conteneur `sfd-postgres`, le port hôte paramétré via `PGPORT`, et un healthcheck `pg_isready`. L'absence du conteneur et le refus sur 5432 expliquent directement l'échec de connexion depuis la configuration locale par défaut. Les noms de variables de connexion ont été vérifiés sans afficher leurs valeurs.

La variante Fabric [compose-couch.yaml](../../../fabric-samples/test-network/compose/compose-couch.yaml) définit des services CouchDB associés aux peers. L'inspection n'établit pas que cette variante a servi à créer les conteneurs actuels; aucun conteneur CouchDB n'est présent, donc une configuration CouchDB active n'est pas vérifiable.

## 5. Volumes persistants et risque PostgreSQL

| Volume constaté | Labels Compose / volume logique | Création | Taille rapportée Docker | État de vérification |
|---|---|---|---:|---|
| `sfd-agnostic-trace_sig-pgdata` | projet `sfd-agnostic-trace`, volume `sig-pgdata` | 2026-06-04 12:07:04 +02:00 | 71,51 MB | Volume présent; aucun conteneur PostgreSQL n'y est attaché; contenu non inspecté |
| `compose_peer0.org1.example.com` | projet `compose`, volume peer Org1 | 2026-11-04 11:49:03 +01:00 | 163 kB | Présence et montage confirmés; contenu non inspecté |
| `compose_peer0.org2.example.com` | projet `compose`, volume peer Org2 | 2026-11-04 11:49:03 +01:00 | 163 kB | Présence et montage confirmés; contenu non inspecté |
| `compose_orderer.example.com` | projet `compose`, volume orderer | 2026-11-04 11:49:03 +01:00 | 128,1 MB | Présence et montage confirmés; contenu non inspecté |

Le Compose applicatif déclare actuellement `sfd_pgdata`. Sous le nom de projet par défaut `sfd-agnostic-trace`, le volume attendu serait `sfd-agnostic-trace_sfd_pgdata`, que `docker volume inspect` ne trouve pas. Le volume disponible porte plutôt le nom logique `sig-pgdata`. Cela indique une divergence de nommage ou de version de configuration; cela ne prouve ni que la base existante est valide, ni qu'elle est vide, ni qu'elle a été perdue.

Les tailles Docker ne permettent pas de déduire le contenu ou l'intégrité des volumes. La lecture directe des fichiers persistant demeure bloquée par les permissions disponibles; aucun accès privilégié n'a été tenté. Un lancement du Compose actuel avant clarification pourrait créer/utiliser un volume différent du volume existant et présenter à l'application une base nouvellement initialisée.

## 6. Problèmes, causes probables et actions proposées

| Composant | Symptôme et preuves | Cause probable / certitude | Action corrective proposée (non exécutée) | Risques |
|---|---|---|---|---|
| Peers et orderer | Arrêtés, code 255, mêmes heures d'arrêt, politique `no`; journaux noyau/daemon compatibles avec un démarrage de l'hôte juste avant | Redémarrage de l'hôte puis absence de redémarrage automatique. Contexte : moyen-élevé; origine précise : indéterminée | Après autorisation, confirmer d'abord l'état et la provenance des volumes, puis envisager l'ordre de démarrage orderer puis peers : `docker start orderer.example.com` puis `docker start peer0.org1.example.com peer0.org2.example.com` | Démarrer Fabric peut déclencher reprise/catch-up et écritures système du ledger; vérifier l'état persistant avant tout démarrage. Ne pas soumettre de transactions de test sans autorisation séparée. |
| PostgreSQL | `sfd-postgres` absent, Compose sans conteneur, port 5432 refusé | Service PostgreSQL arrêté ou non créé; la raison exacte n'est pas déterminée. Élevée pour l'absence actuelle | Ne pas exécuter `docker compose up -d postgres` avant clarification du volume. Confirmer la base et le volume attendus; ensuite seulement, avec autorisation, relancer le service en mappant explicitement le volume voulu | Un nouveau volume vide pourrait être utilisé; une initialisation pourrait créer un état différent et induire les tests en erreur. |
| Volume PostgreSQL | Volume existant `..._sig-pgdata`; Compose déclare `sfd_pgdata`; volume calculé attendu absent | Divergence entre le volume conservé et la déclaration Compose actuelle. Élevée pour la divergence; contenu réel non vérifié | Faire confirmer par le propriétaire quelle base doit être conservée; comparer ensuite la configuration Compose approuvée avec les labels et le montage, en lecture seule d'abord | Remapper vers le mauvais volume peut masquer les données attendues; ne supprimer ni ne remplacer aucun volume. |
| CA Org1 | Port 7054 répond, mais aucune preuve de disponibilité complète du service CA au-delà du TCP | Processus accessible au port; santé fonctionnelle non testée | Aucun redémarrage recommandé sans besoin confirmé; si autorisé, utiliser un contrôle de santé non transactionnel adapté à la CA | Un port ouvert ne garantit ni l'authentification ni l'émission correcte de certificats. |
| Journaux de l'arrêt | Événements Docker anciens absents; nouvelles lectures des journaux de conteneur vides; avertissements Docker système sans noms des conteneurs | Rétention insuffisante ou absence de lien direct entre les lignes visibles et les conteneurs | Pour affiner la cause de redémarrage, examiner les journaux du boot précédent et les événements d'arrêt de l'hôte avec un opérateur autorisé | Les journaux système peuvent contenir des informations d'exploitation; les filtrer avant partage. |

Commandes de diagnostic supplémentaires proposées, non exécutées :

```sh
journalctl --list-boots
journalctl -b -1 --no-pager -u docker.service
journalctl -b -1 --no-pager -k
```

Les commandes de démarrage proposées ci-dessus n'ont pas été exécutées. Toute opération de reprise ou modification de configuration attend une autorisation explicite.

## 7. Vérifications bloquées et informations manquantes

- Contenu des volumes PostgreSQL, peers et orderer : inaccessible avec les permissions disponibles; fichiers de blocs, index, state database, snapshots et données Raft non relus.
- État réel et cohérence de la base PostgreSQL : non vérifiés; aucun conteneur PostgreSQL actif.
- Cause exacte du redémarrage de l'hôte et commande/processus à l'origine des arrêts : non établie par les journaux disponibles.
- Santé applicative de la CA : non vérifiée au-delà de l'ouverture TCP du port 7054.
- État actuel de l'API Node.js : non confirmé par un endpoint ou un processus vérifié dans ce diagnostic.
- Version exacte des images Fabric : tags `latest` observés, digest/version effective non établi.
- Variante Compose Fabric effectivement utilisée (avec ou sans CouchDB) : non prouvée.
- Disponibilité et intégrité du canal `sfdchannel` : impossibles à tester sans peers/orderer opérationnels; aucune commande Fabric de lecture n'a été lancée contre un service actif.

**Aucune réparation, reprise, transaction, modification ou suppression n'a été effectuée.**
