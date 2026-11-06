# Inventaire et préservation des volumes Docker SFD

**Projet :** SFD Agnostic Trace
**Date du relevé :** 5 novembre 2026
**Périmètre :** métadonnées Docker, associations de conteneurs, configurations Compose présentes et historique Git disponible.
**Mode :** lecture seule; aucune opération sur les conteneurs, volumes ou données.

## 1. Résumé et conclusion immédiate

Les métadonnées Docker identifient sans ambiguïté les trois volumes nommés Fabric et les destinations enregistrées dans les conteneurs correspondants. Elles identifient également un volume sans conteneur associé, `sfd-agnostic-trace_sig-pgdata`, portant les labels Compose du projet SFD et le nom logique `sig-pgdata`.

Le Compose actuel du projet déclare au contraire le volume logique `sfd_pgdata`, qui, sous le nom de projet `sfd-agnostic-trace`, correspondrait à `sfd-agnostic-trace_sfd_pgdata`. Ce volume calculé est absent. Le volume existant est donc **probablement un volume PostgreSQL antérieur ou créé sous une autre configuration du projet**, mais son utilisation réelle par PostgreSQL et son contenu ne sont pas prouvés : aucun conteneur Postgres ne lui est actuellement associé, et le volume n’a pas été lu.

Les volumes Fabric nommés sont les volumes déclarés dans le Compose Fabric présent et ils sont attachés aux chemins de persistance attendus. Cela identifie leurs rôles et emplacements, mais **ne prouve ni la présence des blocs, ni la cohérence, ni l’intégrité du ledger**. La lecture directe du contenu des volumes demeure bloquée par les permissions disponibles.

**Conclusion générale :** correspondances des volumes Fabric nommés confirmées par Docker et Compose; volume PostgreSQL SFD identifié par ses labels, mais association à une ancienne base seulement probable; contenu et intégrité de tous les volumes restent non vérifiés.

## 2. Méthode et limites

Commandes de lecture utilisées :

- `docker volume ls`
- `docker volume inspect <volume>`
- `docker system df -v`
- `docker ps -a`
- `docker inspect <conteneur>`
- `docker compose -f docker-compose.yml -p sfd-agnostic-trace ps -a`
- Lecture des lignes de montage dans `docker-compose.yml` et `fabric-samples/test-network/compose/compose-test-net.yaml`
- `git log` et recherche dans l’historique Git du projet pour les noms de volumes PostgreSQL

Aucune variable d’environnement, valeur de secret, clé privée ou contenu de `.env` n’a été affiché. Aucune commande `sudo` n’a été exécutée. Aucun volume n’a été monté dans un nouveau conteneur; aucune opération de démarrage, arrêt, suppression, copie, sauvegarde ou restauration n’a été faite.

Les champs `Mountpoint` sont des chemins rapportés par le daemon Docker. Ils ne constituent pas une preuve que leur contenu est lisible par l’utilisateur courant. Les tailles ci-dessous sont celles rapportées par `docker system df -v`; elles ne permettent pas d’inférer la présence ou l’intégrité d’une base ou d’un ledger.

Pour tous les volumes de cet inventaire, `docker volume inspect` rapporte le point de montage `/var/lib/docker/volumes/<nom-du-volume>/_data`. Le nom de volume de la première colonne remplace littéralement `<nom-du-volume>`. Le pilote et la portée sont `local` pour tous les volumes listés.

## 3. Inventaire des volumes Docker

Les labels complets de configuration Compose sont résumés par projet et nom logique pour éviter d’alourdir le tableau. Les volumes Fabric et PostgreSQL ciblés sont indiqués séparément des volumes d’une autre application présents sur le même daemon.

| Volume Docker | Créé | Pilote / portée | Labels d’origine rapportés | Taille Docker | Conteneur(s) actuellement référencé(s) | Évaluation |
|---|---|---|---|---:|---|---|
| `compose_peer0.org1.example.com` | 2026-11-04 11:49:03 +01:00 | `local` / `local` | Compose `project=compose`, `volume=peer0.org1.example.com`, version 2.40.0 | 163 kB | `peer0.org1.example.com` (arrêté), destination `/var/hyperledger/production` | Volume ledger du peer Org1, association certaine |
| `compose_peer0.org2.example.com` | 2026-11-04 11:49:03 +01:00 | `local` / `local` | Compose `project=compose`, `volume=peer0.org2.example.com`, version 2.40.0 | 163 kB | `peer0.org2.example.com` (arrêté), destination `/var/hyperledger/production` | Volume ledger du peer Org2, association certaine |
| `compose_orderer.example.com` | 2026-11-04 11:49:03 +01:00 | `local` / `local` | Compose `project=compose`, `volume=orderer.example.com`, version 2.40.0 | 128,1 MB | `orderer.example.com` (arrêté), destination `/var/hyperledger/production/orderer` | Persistance orderer/Raft probable et déclarée par Compose |
| `sfd-agnostic-trace_sig-pgdata` | 2026-06-04 12:07:04 +02:00 | `local` / `local` | Compose `project=sfd-agnostic-trace`, `volume=sig-pgdata`, version 2.40.0 | 71,51 MB | Aucun (`Links=0`) | Volume probablement lié à PostgreSQL du projet; association réelle et contenu non confirmés |
| `96ed2cc745e42fbff5fae009e43446946feaffb68001a7053ccac787a5459352` | 2026-11-04 11:49:03 +01:00 | `local` / `local` | Volume anonyme (`com.docker.volume.anonymous`) | 0 B | `peer0.org1.example.com` (arrêté), destination `/var/hyperledger` | Volume anonyme parent; contenu/rôle précis non vérifiés |
| `0944a834fece0335871314aaaa0aa5865e581f8b0a359485a373c91ec2fc2e43` | 2026-11-04 11:49:03 +01:00 | `local` / `local` | Volume anonyme | 0 B | `peer0.org2.example.com` (arrêté), destination `/var/hyperledger` | Volume anonyme parent; contenu/rôle précis non vérifiés |
| `72c5a37ce1bbb473aa4242b72de7781a62f5e8e4158c36a03c6ea504928fd2c5` | 2026-11-04 11:49:03 +01:00 | `local` / `local` | Volume anonyme | 0 B | `orderer.example.com` (arrêté), destination `/var/hyperledger` | Volume anonyme parent; le chemin du ledger orderer est recouvert par le volume nommé enfant |
| `bf5f729b593ef88b21f77d095f378b62be95eb5c9e7b06f1fde18a630964b7a0` | 2026-11-04 11:49:03 +01:00 | `local` / `local` | Volume anonyme | 49,77 kB | `orderer.example.com` (arrêté), destination `/etc/hyperledger/fabric` | Configuration potentiellement présente; ne pas assimiler au ledger |
| `soraya_evolution_data` | 2026-06-30 13:56:39 +02:00 | `local` / `local` | Compose `project=soraya`, `volume=evolution_data` | 0 B | `soraya-evolution` (redémarrage en boucle), destination `/evolution/instances` | Autre projet; hors périmètre SFD |
| `soraya_postgres_data` | 2026-06-30 10:36:31 +02:00 | `local` / `local` | Compose `project=soraya`, `volume=postgres_data` | 67,16 MB | Aucun (`Links=0`) | Autre projet; ne pas confondre avec le volume PostgreSQL SFD |
| `soraya_redis_data` | 2026-06-30 10:36:31 +02:00 | `local` / `local` | Compose `project=soraya`, `volume=redis_data` | 34,7 kB | `soraya-redis` (actif), destination `/data` | Autre projet; hors périmètre SFD |

Le volume attendu suivant n’est pas présent : `sfd-agnostic-trace_sfd_pgdata`.

Un volume avec `Links=0` est non référencé par un conteneur actuel dans l’inventaire Docker; le qualifier d’orphelin ne signifie pas qu’il est inutile. Ne pas supprimer un volume non référencé sans identification explicite et sauvegarde autorisée.

### Valeurs des labels Compose

Les volumes nommés portant les labels Compose ont également un label `com.docker.compose.config-hash`. Valeurs exactes relevées par `docker volume inspect` :

| Volume | `com.docker.compose.config-hash` | Autres labels Compose |
|---|---|---|
| `compose_peer0.org1.example.com` | `dad6beadf33d97122e78dbfe6bd2bc6d71bb9a478ead2bac3ac769bd5d66f090` | `project=compose`, `version=2.40.0`, `volume=peer0.org1.example.com` |
| `compose_peer0.org2.example.com` | `36029bf793a3760f9c119994b95d03e40dcaf051d1fec9e81e80ce01bd9074ff` | `project=compose`, `version=2.40.0`, `volume=peer0.org2.example.com` |
| `compose_orderer.example.com` | `fc18eb100177046935700c2ec6e86bea0f25d9a538febee236bf3e75dd982e16` | `project=compose`, `version=2.40.0`, `volume=orderer.example.com` |
| `sfd-agnostic-trace_sig-pgdata` | `597a819ad40006ef80fa88bd29ace9e6fcff9b0f2e5a8e42ab66623e5a381257` | `project=sfd-agnostic-trace`, `version=2.40.0`, `volume=sig-pgdata` |
| `soraya_evolution_data` | `890c9165805b58fa405069a58d1fadd7bafafe949ae632f690c7fa3f740d358a` | `project=soraya`, `version=2.40.0`, `volume=evolution_data` |
| `soraya_postgres_data` | `ab20d73875bed65e9f5f9f9c37d88b3e7081ba0a9f0605845100e289af859a55` | `project=soraya`, `version=2.40.0`, `volume=postgres_data` |
| `soraya_redis_data` | `4c65d9185925867d7a450cd934b4582b66b98022dcdc0746737fdcc0f1226970` | `project=soraya`, `version=2.40.0`, `volume=redis_data` |

Les quatre volumes anonymes portent le label `com.docker.volume.anonymous` avec une valeur vide; ils n’ont pas de labels Compose déclarés.

## 4. Correspondance conteneurs, volumes et chemins

### Fabric

| Conteneur | État relevé | Volume | Destination dans le conteneur | Correspondance |
|---|---|---|---|---|
| `peer0.org1.example.com` | Arrêté | `compose_peer0.org1.example.com` (nommé) | `/var/hyperledger/production` | Déclaré par le Compose Fabric; correspond au volume de persistance du peer |
| `peer0.org1.example.com` | Arrêté | `96ed2cc…9352` (anonyme) | `/var/hyperledger` | Montage parent supplémentaire enregistré par Docker |
| `peer0.org2.example.com` | Arrêté | `compose_peer0.org2.example.com` (nommé) | `/var/hyperledger/production` | Déclaré par le Compose Fabric; correspond au volume de persistance du peer |
| `peer0.org2.example.com` | Arrêté | `0944a8…2e43` (anonyme) | `/var/hyperledger` | Montage parent supplémentaire enregistré par Docker |
| `orderer.example.com` | Arrêté | `compose_orderer.example.com` (nommé) | `/var/hyperledger/production/orderer` | Déclaré par le Compose Fabric; correspond à la persistance de l’orderer |
| `orderer.example.com` | Arrêté | `72c5a3…2c5` (anonyme) | `/var/hyperledger` | Montage parent; le sous-chemin `production/orderer` est recouvert par le volume nommé |
| `orderer.example.com` | Arrêté | `bf5f72…b7a0` (anonyme) | `/etc/hyperledger/fabric` | Montage de configuration, pas un chemin de persistance ledger |

`compose-test-net.yaml` déclare explicitement les volumes nommés peers sur `/var/hyperledger/production` et celui de l’orderer sur `/var/hyperledger/production/orderer`. Les inspections Docker des conteneurs arrêtés reproduisent ces mêmes noms et destinations.

Les montages anonymes des peers sur `/var/hyperledger` et de l’orderer sur `/var/hyperledger` sont présents dans l’inspection Docker mais ne figurent pas dans la section `volumes:` du Compose Fabric consulté. Leur origine exacte n’est pas prouvée par les seules métadonnées disponibles; ils peuvent provenir d’un volume déclaré par l’image ou d’une autre configuration lors de la création des conteneurs. Les destinations enfant spécifiques sont montées au-dessus du parent : les fichiers visibles sous `/var/hyperledger/production` pour les peers proviennent du volume nommé, et `/var/hyperledger/production/orderer` pour l’orderer provient de son volume nommé.

### PostgreSQL SFD

| Élément | Valeur observée |
|---|---|
| Service déclaré | `postgres` |
| `container_name` déclaré | `sfd-postgres` |
| Montage déclaré dans le Compose actuel | `sfd_pgdata:/var/lib/postgresql/data` |
| Nom Docker attendu avec le projet `sfd-agnostic-trace` | `sfd-agnostic-trace_sfd_pgdata` |
| Volume attendu constaté | Absent |
| Volume existant portant les labels SFD | `sfd-agnostic-trace_sig-pgdata` |
| Nom logique dans ses labels Compose | `sig-pgdata` |
| Conteneur PostgreSQL associé | Aucun; `sfd-postgres` absent et `Links=0` |

## 5. Analyse du décalage PostgreSQL et de l’historique disponible

Faits directement vérifiés :

1. Le fichier actuel [docker-compose.yml](../../docker-compose.yml) déclare `sfd_pgdata` pour `/var/lib/postgresql/data`.
2. Docker rapporte un volume `sfd-agnostic-trace_sig-pgdata` portant les labels `com.docker.compose.project=sfd-agnostic-trace` et `com.docker.compose.volume=sig-pgdata`.
3. Le volume `sfd-agnostic-trace_sfd_pgdata` n’existe pas et le conteneur `sfd-postgres` est absent.
4. Le volume `sig-pgdata` a été créé le 4 juin 2026, tandis que le commit Git qui introduit le `docker-compose.yml` actuellement suivi est daté du 18 juin 2026. La version de ce fichier dans ce commit déclare déjà `sfd_pgdata`.
5. La recherche dans l’historique Git disponible n’a pas trouvé de référence à `sig-pgdata`. Le seul fichier Compose applicatif trouvé dans le projet est le fichier actuel.

Interprétation limitée : les labels Docker et la date rendent **probable** que `sfd-agnostic-trace_sig-pgdata` provienne d’une configuration Compose du projet SFD, éventuellement antérieure ou différente de celle actuellement suivie. Ils ne prouvent pas que le volume a effectivement servi de répertoire de données PostgreSQL, qu’il contient une base initialisée ou que cette base correspond aux données métier attendues. L’historique Git consulté ne contient pas la configuration antérieure nécessaire pour confirmer cette correspondance.

Les labels associent le volume à un projet Compose, mais ne permettent pas, à eux seuls, de retrouver le service qui l’a monté. Le `config-hash` du volume n’a pas été relié à un fichier historique. Il n’est donc pas justifié de modifier le Compose actuel ou de démarrer PostgreSQL en supposant que le volume existant est interchangeable avec le volume déclaré.

## 6. État de vérification des données Fabric

Les correspondances conteneur-volume-chemin sont confirmées par `docker inspect` et conformes aux déclarations du Compose Fabric consulté. Les inspections précédentes ont relevé les tailles Docker de 163 kB pour chacun des volumes peers et 128,1 MB pour l’orderer.

Ces constats n’établissent pas :

- la présence de blocs de `sfdchannel` dans chaque volume;
- les fichiers LevelDB, index, snapshots ou données de lifecycle effectivement présents;
- l’état des données Raft de l’orderer;
- la synchronisation entre les deux peers;
- l’intégrité ou la capacité de reprise des données.

La lecture directe des répertoires `/var/lib/docker/volumes/.../_data` n’a pas été réalisée, les permissions disponibles ne le permettant pas. Les tailles Docker ne sont pas une preuve suffisante. Voir aussi [audit-persistance-ledger.md](./audit-persistance-ledger.md), qui documente les limites de l’inspection antérieure.

## 7. Rôle, certitude et risques par volume

| Volume | Rôle probable et données susceptibles d’être présentes | Certitude de l’association | Risque de remplacement ou d’absence | Précautions avant reprise |
|---|---|---|---|---|
| `compose_peer0.org1.example.com` | État persistant du peer Org1, potentiellement blocs, index, state database et métadonnées Fabric sous `production` | Élevée pour le peer et le chemin; contenu non vérifié | Remplacement/perte pourrait rendre indisponible l’historique local Org1 ou nécessiter une resynchronisation; conséquences exactes non établies | Préserver le volume; vérifier son contenu par procédure autorisée avant toute reprise; ne pas réinitialiser le peer |
| `compose_peer0.org2.example.com` | État persistant du peer Org2, potentiellement blocs, index, state database et métadonnées Fabric | Élevée pour le peer et le chemin; contenu non vérifié | Même risque que pour Org1; égalité des tailles ne signifie pas égalité des données | Préserver; inspecter sans écrire; ne pas supposer qu’Org2 peut remplacer Org1 |
| `compose_orderer.example.com` | Persistance de l’orderer sous `/var/hyperledger/production/orderer`, susceptible de contenir données de blocs et état Raft | Élevée pour l’orderer et le chemin; contenu exact non vérifié | Remplacement/perte peut compromettre la reprise de l’orderer et l’accès aux blocs distribués | Ne pas supprimer ni recréer; documenter l’état avant tout démarrage |
| `sfd-agnostic-trace_sig-pgdata` | Probablement données PostgreSQL du projet SFD sous le chemin usuel `PGDATA`; aucune lecture de contenu | Moyenne pour l’origine projet grâce aux labels; faible à moyenne pour l’association effective à PostgreSQL | Non-réutilisation peut écarter des données existantes; utilisation comme PGDATA sans vérification peut échouer ou exposer un état inattendu | Ne pas lancer le Compose actuel en supposant qu’il utilisera ce volume; identifier sa structure et sa version PostgreSQL avec une inspection autorisée |
| `sfd-agnostic-trace_sfd_pgdata` | Volume attendu par la configuration actuelle | Nul, car volume absent | Une future création automatique pourrait fournir une base vide séparée de l’ancien volume | Ne pas déclencher de création avant décision sur la base à conserver |
| Volumes anonymes peers (`96ed2…`, `0944a8…`) | Données ou répertoires sous le montage parent `/var/hyperledger`, hors des chemins enfant recouverts | Élevée pour leur attachement aux conteneurs; rôle interne non établi | Leur suppression pourrait retirer des données non présentes dans le volume nommé; les tailles rapportées à 0 B ne prouvent pas qu’ils sont inutiles | Conserver avec les conteneurs/volumes nommés; ne pas interpréter le `0 B` comme absence de fichiers |
| Volume anonyme orderer (`72c5a3…`) | Répertoires sous `/var/hyperledger` hors du sous-chemin orderer recouvert | Élevée pour l’attachement; rôle interne non établi | Même risque d’éléments auxiliaires non documentés | Préserver jusqu’à identification du contenu |
| Volume anonyme orderer (`bf5f72…`) | Configuration éventuelle sous `/etc/hyperledger/fabric` | Élevée pour l’attachement; nature précise non vérifiée | Perte de configuration pourrait gêner une reprise; ne pas le confondre avec le volume de ledger | Préserver; éviter tout affichage de clés ou secrets s’il contient des fichiers sensibles |

Les volumes `soraya_*` appartiennent à un autre projet selon leurs labels Compose et ne sont pas des volumes SFD. Ils ne doivent pas être utilisés ni supprimés dans le cadre de cet audit.

## 8. Recommandations de préservation

1. Ne supprimer, ne pruner, ne renommer et ne remplacer aucun des volumes SFD/Fabric identifiés, y compris les volumes anonymes attachés aux conteneurs arrêtés.
2. Ne pas démarrer PostgreSQL avec le Compose actuel tant que le volume de données voulu n’est pas confirmé. Le Compose actuel ne référence pas le volume existant `sig-pgdata`.
3. Ne pas démarrer les peers ou l’orderer tant que l’état des volumes et la procédure de reprise Fabric ne sont pas établis. La présente mission n’autorise pas une reprise.
4. Avant toute opération d’écriture ultérieure, obtenir une approbation explicite et prévoir une sauvegarde cohérente hors ligne, avec vérification de la capacité de restauration. Aucune sauvegarde n’a été faite pendant cet audit.
5. Maintenir une correspondance documentée entre chaque conteneur et ses volumes, sans se fier uniquement au nom ou à la taille.
6. Garder les montages anonymes associés aux conteneurs Fabric jusqu’à preuve qu’ils ne contiennent rien de nécessaire.

## 9. Vérifications encore nécessaires

- Lire, en lecture seule, les métadonnées et listes de fichiers des volumes sous `/var/lib/docker/volumes/.../_data`; les permissions courantes ne le permettent pas. Ne pas afficher le contenu de clés, certificats privés, mots de passe ou données métier.
- Déterminer si `sig-pgdata` contient un répertoire de données PostgreSQL initialisé, sa version majeure et ses dates; cela requiert une lecture autorisée du volume, sans démarrer de conteneur.
- Rechercher auprès du propriétaire ou dans les archives hors du dépôt l’ancienne configuration ayant déclaré le volume logique `sig-pgdata`; aucune référence n’a été trouvée dans l’historique Git disponible.
- Vérifier la structure des volumes peers et orderer, notamment les données de `sfdchannel`, les snapshots/index et le stockage Raft, sans conclure à l’intégrité sur la seule présence des fichiers.
- Établir si le volume attendu `sfd_pgdata` doit remplacer `sig-pgdata`, ou si le Compose doit être adapté ultérieurement. Toute modification est hors périmètre et nécessite une autorisation séparée.
- Pour le volume PostgreSQL, confirmer si le répertoire est exploitable par la version `postgres:16-alpine` actuellement déclarée. Cette compatibilité n’a pas été testée.

### Commandes de lecture que l’utilisateur peut exécuter lui-même si l’accès privilégié est nécessaire

Les commandes suivantes ne sont pas exécutées par l’assistant. Elles sont proposées uniquement pour une inspection de métadonnées et de noms/taille de fichiers, sans lire les contenus. Les exécuter avec `sudo` selon la politique locale et ne pas partager de sortie contenant des noms sensibles :

```sh
sudo find /var/lib/docker/volumes/sfd-agnostic-trace_sig-pgdata/_data -xdev -maxdepth 2 -printf '%y %s %TY-%Tm-%TdT%TH:%TM:%TS %p\n'
sudo find /var/lib/docker/volumes/compose_peer0.org1.example.com/_data -xdev -maxdepth 5 -printf '%y %s %TY-%Tm-%TdT%TH:%TM:%TS %p\n'
sudo find /var/lib/docker/volumes/compose_peer0.org2.example.com/_data -xdev -maxdepth 5 -printf '%y %s %TY-%Tm-%TdT%TH:%TM:%TS %p\n'
sudo find /var/lib/docker/volumes/compose_orderer.example.com/_data -xdev -maxdepth 5 -printf '%y %s %TY-%Tm-%TdT%TH:%TM:%TS %p\n'
```

Cette étape pourrait établir la présence de fichiers et leurs tailles/dates, mais ne suffirait toujours pas à valider cryptographiquement le ledger ou la cohérence d’une base. Toute commande de sauvegarde, restauration, démarrage ou réparation constitue une étape distincte et nécessite une autorisation explicite.
