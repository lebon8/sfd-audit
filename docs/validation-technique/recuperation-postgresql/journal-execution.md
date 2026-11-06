# Journal d'exécution — récupération PostgreSQL SFD

| Date/heure locale | Phase | Opération | Résultat |
|---|---|---|---|
| 2026-11-05 | Phase 1 — contrôle initial | Inspection Docker du volume `sfd-agnostic-trace_sig-pgdata`, des conteneurs et des montages | Volume présent; `Links=0`; aucun conteneur PostgreSQL SFD trouvé |
| 2026-11-05 | Phase 1 — contrôle initial | Contrôle en lecture seule des chemins de l'original et de la sauvegarde, des permissions et de l'espace disque | Le répertoire de sauvegarde existe mais est inaccessible au compte courant; accès au chemin interne du volume Docker refusé; capacité `/home` 115 Go, `/var` 419 Mo, `/tmp` 1,7 Go |
| 2026-11-05 | Phase 1 — contrôle initial | Exécution locale de `pg_controldata` sur la sauvegarde | Bloquée par `Permission denied` sur `global/pg_control` |
| 2026-11-05 | Phase 1 — contrôle initial | Création des rapports de phase | `01-controle-initial.md` créé; opérations ultérieures non commencées |
| 2026-11-05 12:49 +01:00 | Phase 1 — complément de preuves | Le propriétaire a transmis les résultats des contrôles historiques réalisés avant l'intervention | `rsync -aHAX --numeric-ids` : 71 505 869 octets; `rsync -aHAXnic --numeric-ids` : aucune différence; `pg_controldata` original/sauvegarde identiques; PostgreSQL 16, system identifier `7647479725618155554`, état `shut down`, checkpoint `0/4A26258`, WAL `000000010000000000000004`, timeline `1` |
| 2026-11-05 12:49 +01:00 | Phase 1 — évaluation consolidée | Actualisation de `01-controle-initial.md` à partir des résultats historiques et des limites d'accès actuelles | Phase 1 évaluée comme terminée pour préparer une décision de phase suivante; les résultats historiques sont attribués au propriétaire et ne sont pas présentés comme une nouvelle exécution |
| 2026-11-05 13:02 +01:00 | Phase 2 — copie de travail (résultats communiqués) | Le propriétaire a signalé la création de `/home/dorian/sauvegardes-sfd/sfd-pgdata-travail` | `rsync` terminé à 100 %; 71 505 869 octets, 1 288 fichiers; `to-chk=0/1315`; comparaison `rsync -aHAXnic --numeric-ids` avec la sauvegarde principale sans différence |
| 2026-11-05 13:02 +01:00 | Phase 2 — contrôle d'accès | Vérification locale en lecture seule de l'existence et des permissions de la copie de travail | Répertoire présent, mode `0700`, UID/GID `70:70`; inaccessible au compte courant pour lecture/traversée. Aucun contenu ouvert |
| 2026-11-05 13:02 +01:00 | Phase 2 — préparation `pg_controldata` | Construction de la commande Docker isolée, sans exécution | Commande préparée avec `--network none`, root filesystem `--read-only`, seul bind de copie de travail en lecture seule, entrypoint explicite `pg_controldata`, aucun port publié |
| 2026-11-05 13:02 +01:00 | Phase 2 — attente de résultat | En attente de la sortie de `pg_controldata` exécuté par le propriétaire | Aucun conteneur lancé par l'assistant; aucune métadonnée de la copie de travail encore observée |
| 2026-11-05 13:05 +01:00 | Phase 2 — résultat `pg_controldata` de la copie de travail | Le propriétaire a transmis la sortie de la commande exécutée avec le montage de travail en lecture seule, `--network none` et `--read-only` | La sortie rapporte control/catalog versions `1300`/`202307071` (PostgreSQL 16), system identifier `7647479725618155554`, état `shut down`, checkpoint `0/4A26258`, REDO WAL `000000010000000000000004`, timeline `1`, NextXID `0:41265` |
| 2026-11-05 13:05 +01:00 | Phase 2 — comparaison des métadonnées | Comparaison des champs transmis avec les valeurs historiques de l'original et de la sauvegarde principale | Toutes les valeurs demandées concordent. Les métadonnées de contrôle de la copie de travail correspondent aux valeurs historiques rapportées pour les deux autres copies; cela ne démontre pas l'intégrité logique de toutes les tables |
| 2026-11-05 13:10 +01:00 | Phase 3 — précontrôles | Vérification du chemin de travail, du nom de conteneur, de l'image, des montages originaux/sauvegarde principale et de l'espace disque | Copie de travail présente; conteneur `sfd-pg-recovery` absent; image `postgres:16` présente; aucun montage du volume original ou de la sauvegarde principale; environ 123 Go libres sur `/home` |
| 2026-11-05 13:10 +01:00 | Phase 3 — démarrage isolé | `docker run -d --name sfd-pg-recovery --network none --restart no --mount type=bind,source=/home/dorian/sauvegardes-sfd/sfd-pgdata-travail,target=/var/lib/postgresql/data postgres:16` | Conteneur démarré; réseau `none`; aucun port publié; seul montage vers la copie de travail, RW |
| 2026-11-05 13:10 +01:00 | Phase 3 — démarrage et disponibilité | Inspection Docker, `docker logs --tail 100 sfd-pg-recovery`, puis `docker exec sfd-pg-recovery pg_isready -h /var/run/postgresql` | PostgreSQL 16.15 prêt; cluster existant reconnu, initialisation ignorée; socket local accepte les connexions |
| 2026-11-05 13:10 +01:00 | Phase 3 — connexion SQL read-only | Tentatives avec `psql -X -U postgres -d postgres` et `psql -X -U sfd -d postgres`, chacune dans `BEGIN READ ONLY` | Les deux échouent avant la requête SQL : rôles `postgres` et `sfd` absents; aucun rôle créé |
| 2026-11-05 13:10 +01:00 | Phase 3 — arrêt contrôlé | `docker stop -t 60 sfd-pg-recovery`, inspection après arrêt et lecture des journaux | Conteneur arrêté, code 0, OOM false; journal PostgreSQL rapporte checkpoint d'arrêt à `0/4A26308`, puis arrêt propre |
| 2026-11-05 13:10 +01:00 | Phase 3 — documentation | Création de `03-demarrage-et-tests-reels.md` et mise à jour du présent journal | Résultats, limites et écritures sur la copie de travail consignés; inventaire SQL non réalisé |

## Sécurité et état

- Aucune commande `sudo` n'a été exécutée.
- Aucun fichier de base, configuration sensible, secret ou clé privée n'a été affiché.
- Le volume original et la sauvegarde principale n'ont été ni montés ni modifiés.
- Un conteneur temporaire `sfd-pg-recovery` a été créé et démarré conformément à l'autorisation, avec la seule copie de travail montée en lecture-écriture; il a ensuite été arrêté proprement et conservé.
- La copie de travail a été créée par le propriétaire avant la phase 3; elle a été montée par l'assistant uniquement dans le conteneur isolé autorisé.
- PostgreSQL a écrit un checkpoint d'arrêt dans la copie de travail; sa LSN est passée à `0/4A26308`. La copie de travail ne doit plus être considérée byte-à-byte identique à la sauvegarde principale.
- L'accès direct actuel aux fichiers demeure bloqué par les permissions; cette limite n'est pas interprétée comme une corruption.
- Phase 1 est évaluée à partir des contrôles Docker courants et des résultats historiques rapportés par le propriétaire.
- Le résultat de `pg_controldata` est rapporté par le propriétaire; l'assistant n'a pas exécuté cette commande lui-même.
- Les métadonnées de contrôle concordent, mais l'intégrité logique des bases, schémas, tables et index n'est pas encore vérifiée.
- Le serveur PostgreSQL a été démarré uniquement dans la phase 3 autorisée et sur la copie de travail; aucune réparation ou autre modification structurelle n'a été effectuée.
