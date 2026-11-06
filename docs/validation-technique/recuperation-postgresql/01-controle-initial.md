# 01 — Contrôle initial de l'ancienne base PostgreSQL

**Projet :** SFD Agnostic Trace
**Date du contrôle :** 5 novembre 2026
**Phase :** 1 — contrôles initiaux en lecture seule
**Résultat :** contrôle initial évalué à partir des preuves disponibles, y compris les résultats historiques fournis par le propriétaire. L'accès direct actuel reste bloqué par les permissions; aucune corruption n'est démontrée.

## 1. Résumé

- Docker confirme l'existence du volume `sfd-agnostic-trace_sig-pgdata`, créé le 4 juin 2026, pilote `local`, avec les labels Compose `project=sfd-agnostic-trace` et `volume=sig-pgdata`.
- Le chemin de montage Docker du volume original est `/var/lib/docker/volumes/sfd-agnostic-trace_sig-pgdata/_data`, mais les permissions ne permettent pas à l'utilisateur courant de traverser `/var/lib/docker/volumes`.
- Le répertoire de sauvegarde principal `/home/dorian/sauvegardes-sfd/sfd-agnostic-trace_sig-pgdata` existe. Il appartient à l'UID/GID `70:70`, mode `0700`. L'utilisateur courant ne peut pas lire ses fichiers ni parcourir le répertoire.
- Aucune association à un conteneur n'a été trouvée pour le volume original (`Links=0`); aucun conteneur n'utilise le chemin de sauvegarde.
- Les résultats historiques fournis par le propriétaire indiquent que les deux exécutions de `pg_controldata` (original et sauvegarde) étaient identiques : PostgreSQL 16, identifiant `7647479725618155554`, état `shut down`, dernier checkpoint `0/4A26258`, WAL `000000010000000000000004`, timeline `1`.
- Le propriétaire rapporte aussi une copie faite par `rsync -aHAX --numeric-ids` (71 505 869 octets), puis une comparaison `rsync -aHAXnic --numeric-ids` sans différence.
- Lors de notre contrôle, `pg_controldata` version 16 était disponible localement, mais l'accès actuel à `global/pg_control` dans la sauvegarde a échoué avec `Permission denied`. Cette limitation d'accès ne contredit pas les résultats historiques fournis et ne constitue pas un indice de corruption.
- La capacité mesurée est de 115 Go disponibles sur `/home`, 419 Mo sur `/var` et 1,7 Go sur `/tmp`. La taille de la sauvegarde n'a pas pu être mesurée avec le compte courant (`du` a retourné une erreur de permission).

**Conclusion de phase :** au vu de l'ensemble des éléments, le contrôle initial est considéré satisfait pour l'existence des emplacements, l'identification du cluster et l'intégrité de la copie principale telle que vérifiée historiquement par le propriétaire. Ces résultats historiques ne sont pas indépendamment reproductibles avec les permissions actuelles. La copie de travail n'a pas été créée; la Phase 2 n'a pas commencé et nécessite une autorisation explicite.

## 2. Contrôles effectués et résultats

| Vérification | Commande(s) exécutée(s) | Résultat observé | Limites |
|---|---|---|---|
| Existence du volume original | `docker volume inspect sfd-agnostic-trace_sig-pgdata` | Volume présent; `Driver=local`; création `2026-06-04T12:07:04+02:00`; point de montage `/var/lib/docker/volumes/sfd-agnostic-trace_sig-pgdata/_data`; label Compose projet `sfd-agnostic-trace`, volume logique `sig-pgdata` | Les métadonnées Docker n'établissent pas que le volume contient un cluster utilisable |
| Accès au volume original | `stat`, tests de présence/lecture sur `_data`, `namei -l` | `namei` montre `/var/lib/docker` en mode `0710`; la traversée de `volumes` est refusée (`Permission denied`). Impossible de vérifier `PG_VERSION`, `global/pg_control`, `base/` et `pg_wal/` avec le compte courant | Aucune élévation de privilèges n'a été tentée |
| Existence de la sauvegarde | `stat`, `namei -l /home/dorian/sauvegardes-sfd/sfd-agnostic-trace_sig-pgdata` | Répertoire existant; mode `0700`, UID/GID `70:70`; ses répertoires parents `/home/dorian` et `/home/dorian/sauvegardes-sfd` sont en mode `0700`, UID/GID `1000:1000` | Les permissions empêchent l'utilisateur courant d'entrer dans le répertoire de sauvegarde |
| Fichiers de cluster dans la sauvegarde | Résultats historiques communiqués : contrôle de la copie principale et `pg_controldata`; contrôle courant : tests de présence/lecture et `stat` sur `PG_VERSION`, `global/pg_control`, `base/`, `pg_wal/` | Le propriétaire rapporte que le cluster PostgreSQL 16 et les répertoires/fichiers requis étaient présents lors des contrôles antérieurs. Aujourd'hui, les chemins internes sont non vérifiables par le compte courant (`Permission denied`) | L'échec courant ne signifie pas que les fichiers sont absents |
| Propriétaires et permissions | `stat -c '%A uid=%u gid=%g type=%F name=%n'` sur les répertoires accessibles | Racine de sauvegarde `drwx------`, UID/GID `70:70`; parents du domicile mode `0700`, UID/GID `1000:1000` | Propriétaires des fichiers à l'intérieur non lisibles |
| Espace disque | `df -h /home /var /tmp`; `df -i /home /var /tmp` | `/home`: 115 Go libres; `/var`: 419 Mo libres; `/tmp`: 1,7 Go libres. Inodes disponibles : `/home` 13 030 641, `/var` 350 552, `/tmp` 121 568 | Les valeurs sont celles du moment du contrôle; `/var` est fortement rempli (96 %) |
| Taille de sauvegarde | Résultat historique communiqué pour rsync; tentative courante `du -sh /home/dorian/sauvegardes-sfd/sfd-agnostic-trace_sig-pgdata` | Le propriétaire rapporte 71 505 869 octets transférés lors de la copie initiale. La commande courante a retourné `Permission denied`; l'affichage résiduel `4.0K` n'est pas représentatif du contenu | La taille rapportée provient du contrôle historique, elle n'a pas été remesurée actuellement |
| Utilisation du volume original | `docker volume inspect`, `docker ps -a`, `docker inspect` des conteneurs | Le volume rapporte `Links=0`; aucun conteneur inspecté ne référence le volume original | État de montage exact des applications en dehors de Docker non couvert |
| Utilisation de la sauvegarde | Parcours en lecture seule des montages `Mounts` de tous les conteneurs présents | Aucun montage dont la source correspond à la sauvegarde n'a été trouvé | Aucun contenu du répertoire n'a été lu |
| Présence d'un conteneur PostgreSQL | `docker ps -a`, `docker inspect sfd-postgres` | Aucun conteneur PostgreSQL/SFD correspondant; `sfd-postgres` absent | Ne renseigne pas sur un processus PostgreSQL hôte éventuellement lancé hors Docker |
| Image PostgreSQL | `docker image inspect postgres:16` | Image locale `postgres:16` présente | Aucun conteneur n'a été créé ou démarré |
| Outil `pg_controldata` | Résultats historiques communiqués pour l'original et la sauvegarde; tentative courante `/usr/lib/postgresql/16/bin/pg_controldata <sauvegarde>` | Historiquement, les sorties des deux répertoires étaient identiques : identifiant `7647479725618155554`, état `shut down`, checkpoint `0/4A26258`, WAL `000000010000000000000004`, timeline `1`, version 16. La tentative courante échoue à lire `global/pg_control` avec `Permission denied` | Les valeurs historiques sont fournies par le propriétaire et non relues par l'assistant pendant cette session |

### Résultats historiques fournis par le propriétaire

Les résultats suivants ont été exécutés avant notre intervention et sont consignés comme preuves communiquées par le propriétaire, pas comme commandes réexécutées ici :

| Vérification historique | Résultat communiqué |
|---|---|
| Copie initiale | `rsync -aHAX --numeric-ids`; 71 505 869 octets transférés vers la sauvegarde principale |
| Comparaison différentielle | `rsync -aHAXnic --numeric-ids`; aucune différence signalée |
| Métadonnées de contrôle de l'original et de la sauvegarde | Résultats `pg_controldata` identiques |
| Version du cluster | PostgreSQL 16; `PG_VERSION` rapporté comme `16` |
| Identifiant système | `7647479725618155554` |
| État du cluster | `shut down` |
| Dernier checkpoint | `0/4A26258` |
| WAL associé | `000000010000000000000004` |
| Timeline | `1` |
| Données de base | OID `16384`, environ 14 Mo; bases système également rapportées présentes |
| Volume / sauvegarde | Environ 69 Mo selon Docker et 71 505 869 octets pour la copie selon rsync |

Ces résultats étayent l'intégrité de la copie principale **au moment de la comparaison historique**. Ils ne valident pas l'intégrité logique des bases, des schémas ou des tables, et ne prouvent pas que les données sont récupérables par l'application.

## 3. Évaluation de la Phase 1 selon l'ensemble des preuves

La Phase 1 visait à confirmer l'existence des deux emplacements, les fichiers de cluster requis, les permissions/propriétaires, l'espace disque, l'absence d'utilisation par un conteneur et les métadonnées du cluster.

| Critère | Évaluation combinée |
|---|---|
| Volume Docker original existe | Confirmé par `docker volume inspect` |
| Répertoire de sauvegarde principale existe | Confirmé par `stat` |
| Fichiers/répertoires de cluster existent | Rapportés vérifiés dans les contrôles historiques; non inspectables actuellement avec le compte courant |
| Copie cohérente au niveau fichier avec la source | Étayée par la comparaison rsync historique sans différences; non répétée |
| Version et identité du cluster | Rapportées par `pg_controldata` historique concordant sur l'original et la sauvegarde |
| Cluster à l'arrêt | Rapporté comme `shut down` par les deux contrôles historiques; pas de démarrage actuel |
| Permissions et propriétaires | Racine de la sauvegarde observée en `0700`, UID/GID `70:70`; contenus internes et permissions originales non consultables |
| Espace disponible pour la copie de travail | Mesuré antérieurement et lors du contrôle courant : environ 115 Go sur `/home`; `/var` dispose d'environ 419 Mo |
| Aucun conteneur Docker n'utilise l'original/la sauvegarde | Confirmé par les montages inspectés et `Links=0` pour le volume original; aucun montage vers la sauvegarde |

**Évaluation :** les preuves historiques fournies, combinées aux contrôles Docker et de permissions actuels, suffisent à considérer la Phase 1 comme satisfaite pour préparer une décision sur la Phase 2. Les données détaillées de contenu et les résultats de rsync ne sont pas indépendamment reproductibles sous les permissions actuelles. Cette limite doit être conservée dans la traçabilité; elle n'est pas un indice de corruption.

## 4. Faits, hypothèses et points bloqués

### Faits observés directement pendant le contrôle courant

- Le volume Docker existe et ses labels l'associent au projet Compose SFD sous le nom logique `sig-pgdata`.
- Le répertoire de sauvegarde existe et ses permissions limitent l'accès à son propriétaire UID 70.
- Aucun conteneur actuel ne référence le volume original ni le chemin de sauvegarde.
- Le compte courant ne peut pas lire les chemins internes des deux emplacements.
- Aucun outil n'a démarré PostgreSQL ou modifié un fichier.

### Résultats historiques communiqués par le propriétaire

- Copie complète avec préservation des attributs signalée; comparaison rsync différentielle sans différence.
- Résultats de `pg_controldata` identiques pour le volume original et la sauvegarde, cluster PostgreSQL 16 à l'arrêt.
- Ces résultats sont une preuve historique rapportée, pas une exécution actuelle de l'assistant.

### Vérifications toujours bloquées ou non établies

- Nouvelle lecture des fichiers `PG_VERSION`, `global/pg_control`, `base/` et `pg_wal/` par le compte courant.
- Reproduction indépendante des valeurs `pg_controldata` et de la comparaison rsync.
- Taille et nombre de fichiers remesurés, propriétaires et permissions des fichiers internes.
- Vérification de l'absence de processus PostgreSQL hôte hors Docker.
- Accessibilité SQL, cohérence des schémas/tables et récupérabilité fonctionnelle, qui relèvent des phases ultérieures et ne sont pas testées.

## 5. Opérations non exécutées

- Aucune commande `sudo`.
- Aucune copie de travail créée.
- Aucun accès direct en écriture au volume original ou à la sauvegarde.
- Aucun conteneur PostgreSQL créé ou démarré.
- Aucune commande `docker compose up/down`, aucune restauration, aucun import SQL et aucune migration.
- Aucune opération Fabric ou ledger.

## 6. Décision de passage

La Phase 1 est évaluée comme terminée sur la base de l'ensemble des preuves décrites ci-dessus, sous réserve que les éléments historiques proviennent du propriétaire et ne soient pas considérés comme une nouvelle exécution. La Phase 2 demeure une opération distincte : elle créerait une copie de travail et n'est pas autorisée par la demande actuelle.

**Aucune copie de travail n'a été créée. Aucune commande privilégiée n'a été exécutée. Attendre une autorisation explicite avant la Phase 2.**
