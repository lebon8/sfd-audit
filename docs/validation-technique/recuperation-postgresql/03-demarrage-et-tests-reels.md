# 03 — Démarrage isolé et tests réels de récupération PostgreSQL

**Projet :** SFD Agnostic Trace
**Date :** 5 novembre 2026
**Périmètre :** démarrage autorisé exclusivement sur la copie de travail, tests locaux non métier et tentative de connexion SQL strictement en lecture seule.

## 1. Résumé exécutif

Le conteneur `sfd-pg-recovery` a été démarré avec l'image locale `postgres:16`, le réseau Docker `none`, aucune publication de port, aucune politique de redémarrage et un seul bind mount en lecture-écriture vers `/home/dorian/sauvegardes-sfd/sfd-pgdata-travail`. Les précontrôles n'ont trouvé aucun conteneur déjà nommé `sfd-pg-recovery`, aucune utilisation Docker du volume original ou de la sauvegarde principale, et environ 123 Go libres sur `/home`.

Le journal PostgreSQL indique que le répertoire contenait déjà un cluster, que l'initialisation a été ignorée, que PostgreSQL 16.15 a démarré et a accepté des connexions. `pg_isready` par socket Unix a répondu `accepting connections`.

La connexion SQL demandée avec le rôle `postgres` a échoué (`role "postgres" does not exist`). Une tentative strictement en lecture seule avec le rôle par défaut `sfd` documenté dans le Compose actuel a également échoué (`role "sfd" does not exist`). Aucun rôle n'a été créé et aucune requête SQL n'a abouti. En conséquence, les catalogues, bases, schémas, tables et contraintes n'ont pas pu être inspectés.

Le conteneur a été arrêté avec `docker stop -t 60`. L'état final est `exited`, code 0, OOM false. Les journaux indiquent un checkpoint d'arrêt sur la copie de travail à `0/4A26308`, suivi d'un arrêt PostgreSQL propre. **Le démarrage a donc écrit dans la copie de travail**, comme prévu et autorisé. Cette copie n'est désormais plus une copie strictement byte-à-byte identique à la sauvegarde principale; la sauvegarde principale et le volume original n'ont pas été montés ni modifiés.

## 2. Précontrôles effectués

| Vérification | Résultat observé |
|---|---|
| Chemin exact de travail | `/home/dorian/sauvegardes-sfd/sfd-pgdata-travail` présent, répertoire, mode `0700`, UID/GID `70:70` |
| Conteneur `sfd-pg-recovery` préexistant | Absent avant démarrage |
| Image `postgres:16` | Présente localement; plateforme `linux/amd64` |
| Volume original | Aucun conteneur Docker inspecté ne le montait |
| Sauvegarde principale | Aucun conteneur Docker inspecté ne montait le chemin |
| Espace `/home` | 123 055 763 456 octets disponibles au contrôle |
| Protection des secrets | Aucun environnement de conteneur ni fichier `.env` affiché |

La copie de travail était inaccessible en lecture directe par le compte courant. Elle a été montée par Docker uniquement selon l'autorisation donnée.

## 3. Configuration d'isolation réellement utilisée

Commande exécutée :

```sh
docker run -d \
  --name sfd-pg-recovery \
  --network none \
  --restart no \
  --mount type=bind,source=/home/dorian/sauvegardes-sfd/sfd-pgdata-travail,target=/var/lib/postgresql/data \
  postgres:16
```

Le contrôle Docker après démarrage a établi :

- conteneur `sfd-pg-recovery` actif;
- `NetworkMode=none`;
- `RestartPolicy=no`;
- un seul montage, la copie de travail vers `/var/lib/postgresql/data`, `RW=true`;
- `PublishedPorts={}`;
- aucun montage du volume original ou de la sauvegarde principale.

Le serveur journalise une écoute sur les adresses IPv4/IPv6 de son espace réseau isolé et sur son socket Unix. Sans interface réseau ni port publié, aucune publication vers l'hôte ou le réseau externe n'a été configurée.

## 4. Commandes et résultats

### Démarrage et journaux

| Commande | Résultat |
|---|---|
| `docker run -d --name sfd-pg-recovery --network none --restart no --mount type=bind,source=/home/dorian/sauvegardes-sfd/sfd-pgdata-travail,target=/var/lib/postgresql/data postgres:16` | Conteneur créé et démarré; ID commençant par `875d48cf` |
| `docker inspect --format=... sfd-pg-recovery` | `Status=running`, `ExitCode=0`, `OOMKilled=false`, aucune erreur, réseau `none`, aucun port publié, un bind mount RW vers la copie de travail |
| `docker logs --tail 100 sfd-pg-recovery` | Cluster existant détecté; initialisation ignorée; PostgreSQL `16.15` prêt à accepter les connexions; arrêt précédent du cluster indiqué comme propre au 8 juin 2026 |

### Disponibilité et connexion SQL

| Commande | Résultat |
|---|---|
| `docker exec sfd-pg-recovery pg_isready -h /var/run/postgresql` | `/var/run/postgresql:5432 - accepting connections` |
| `docker exec sfd-pg-recovery psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -c "BEGIN READ ONLY; SELECT version(); COMMIT;"` | Échec avant exécution SQL : `FATAL: role "postgres" does not exist` |
| `docker exec sfd-pg-recovery psql -X -U sfd -d postgres -v ON_ERROR_STOP=1 -c "BEGIN READ ONLY; SELECT version(); COMMIT;"` | Échec avant exécution SQL : `FATAL: role "sfd" does not exist` |

La seconde tentative a utilisé le rôle par défaut `sfd` déclaré dans la configuration Compose actuelle, sans mot de passe ni affichage de secret. Elle n'a pas créé de rôle ou modifié l'authentification.

L'acceptation de connexions indiquée par `pg_isready` confirme seulement la disponibilité du serveur sur le socket local; elle ne confirme ni un rôle utilisable, ni l'accès aux bases, ni l'intégrité logique des données.

## 5. Arrêt contrôlé et état final

Commandes exécutées :

```sh
docker stop -t 60 sfd-pg-recovery
docker inspect --format='Name={{.Name}} Status={{.State.Status}} ExitCode={{.State.ExitCode}} OOMKilled={{.State.OOMKilled}} Error={{.State.Error}} RestartPolicy={{.HostConfig.RestartPolicy.Name}} NetworkMode={{.HostConfig.NetworkMode}}{{range .Mounts}}{{printf "\nMountType=%s Source=%s Destination=%s RW=%t" .Type .Source .Destination .RW}}{{end}} PublishedPorts={{json .NetworkSettings.Ports}}' sfd-pg-recovery
docker logs --tail 100 sfd-pg-recovery
```

Résultats :

- `Status=exited`, `ExitCode=0`, `OOMKilled=false`, aucun message d'erreur Docker, redémarrage `no`.
- Réseau toujours `none`; aucun port publié; le seul montage inscrit est la copie de travail.
- Les journaux PostgreSQL indiquent une demande d'arrêt, un checkpoint d'arrêt, puis `database system is shut down`.
- Le checkpoint d'arrêt rapporté dans le journal est `0/4A26308` (redo LSN `0/4A26308`); il diffère du checkpoint historique `0/4A26258` observé avant démarrage.
- La vérification finale de `pg_isready` échoue car le conteneur n'est plus en cours d'exécution.

Le code d'arrêt 0 et le message PostgreSQL de fin attestent un arrêt propre. Le checkpoint et le LSN avancés sont cohérents avec l'activité de démarrage et le checkpoint de fermeture; ce ne sont pas des preuves d'intégrité logique des données.

## 6. Niveau de validation atteint

| Niveau | Résultat |
|---|---|
| Conteneur démarré sur le bon chemin de travail | Réussi |
| Isolation réseau et absence de port publié | Confirmées par `docker inspect` |
| Cluster existant reconnu sans initialisation | Confirmé par les journaux |
| Processus PostgreSQL prêt sur socket local | Réussi selon `pg_isready` |
| Connexion SQL comme `postgres` | Échec : rôle absent |
| Connexion SQL comme rôle par défaut courant `sfd` | Échec : rôle absent |
| Lecture des catalogues et inventaire des bases | Non réalisés, faute de rôle valide |
| Accessibilité structurelle des schémas/tables/index/contraintes | Non vérifiée |
| Intégrité logique ou métier | Non vérifiée |
| Récupérabilité applicative | Non vérifiée |

Le démarrage réussi ne suffit pas à qualifier la base de saine. Aucune conclusion n'est tirée sur l'intégrité des tables ou les données métier.

## 7. Modifications et limites

- PostgreSQL a pu écrire dans **la copie de travail uniquement** : le journal montre un checkpoint de fermeture et un LSN plus récent.
- La comparaison antérieure sans différence entre copie de travail et sauvegarde principale s'appliquait avant le démarrage. Après cette phase, une nouvelle comparaison fichier-à-fichier est attendue à diverger, du fait des écritures autorisées sur la copie de travail.
- Le volume original et la sauvegarde principale sont restés non montés dans le conteneur; ils ne sont pas modifiés par cette opération.
- Le conteneur arrêté `sfd-pg-recovery` et le dossier de travail ont été conservés; aucun conteneur n'a été supprimé.
- Il manque un moyen d'authentification déjà existant et autorisé pour un rôle valide. Aucun rôle n'a été deviné au-delà du rôle `sfd` correspondant au défaut documenté, aucun mot de passe n'a été recherché ou exposé.
- Le nom de la base métier/OID `16384`, les schémas et tables, les extensions, les index et contraintes restent à découvrir par accès SQL autorisé.

## 8. Opérations non effectuées

- Aucune connexion TCP n'a été publiée ni configurée.
- Aucune base, table, rôle ou extension n'a été créée ou modifiée.
- Aucune migration, import, écriture métier ou transaction applicative n'a été lancée.
- Aucun `VACUUM`, `REINDEX`, `pg_resetwal` ou réparation n'a été exécuté.
- Le conteneur n'a pas été relancé ou supprimé après l'échec des connexions.
- Aucune sauvegarde, copie ou modification de permissions n'a été faite.

## 9. Suite nécessaire

Avant de poursuivre l'inventaire SQL, le propriétaire doit fournir ou exécuter une méthode d'authentification existante et autorisée pour un rôle déjà présent, sans transmettre de mot de passe ou secret dans le rapport. Après approbation d'une nouvelle session de tests, le conteneur pourra être démarré uniquement avec la même copie de travail, puis les catalogues interrogés dans des transactions `READ ONLY`.

Toute modification d'authentification, création de rôle, réparation, migration, import ou restauration nécessite une autorisation séparée. Le conteneur est actuellement arrêté; ne pas le redémarrer sans instructions complémentaires.
