# Audit forensique non destructif de la persistance Fabric

**Projet :** SFD Agnostic Trace  
**Canal visé :** `sfdchannel`  
**Chaincode visé :** `agnostictrace`  
**Date des vérifications :** 5 novembre 2026  
**Périmètre :** Docker inspect/volume metadata/disk usage et lectures de journaux existants; aucune opération d’écriture.

## Résumé exécutif

Les trois conteneurs Fabric inspectés sont arrêtés. Docker conserve leurs références de montage et rapporte trois volumes nommés (163 kB chacun pour les peers, 128,1 MB pour l’orderer) ainsi que des volumes anonymes attachés. Les montages des peers placent `/var/hyperledger/production` dans le volume nommé; pour l’orderer, le volume nommé est monté sur `/var/hyperledger/production/orderer`.

Les répertoires sous `/var/lib/docker/volumes` ne sont pas accessibles à l’utilisateur courant. Les fichiers de blocs, index, snapshots, state database et Raft n’ont donc pas été listés ni lus. Les tailles Docker ne permettent pas de conclure à leur présence ou absence. Des journaux historiques prouvent que `sfdchannel` a été actif et que les peers ont committé le bloc 4; ils ne prouvent pas le contenu actuel des volumes.

**Conclusion : Données persistantes non vérifiables avec les permissions disponibles.** Cela ne constitue pas une preuve de perte ni une preuve d’intégrité du ledger.

## 1. Méthodes et sécurité

Commandes de lecture utilisées :

- `docker inspect --format ...` sur les trois conteneurs, en excluant les variables d’environnement.
- `docker volume inspect` pour les dates, labels et chemins de montage.
- `docker volume ls` et `docker system df -v` pour l’inventaire et les tailles rapportées par Docker.
- `docker logs --tail 200 --timestamps` avec sélection des dernières lignes; longues chaînes hexadécimales et champs potentiellement sensibles masqués avant affichage.
- Vérifications locales `test -r`, `test -e` et `stat` sur les seuls chemins de volume concernés.

Aucun conteneur n’a été démarré ou créé; aucun volume n’a été supprimé ou monté par un helper; aucun fichier n’a été copié ou modifié; aucune variable d’environnement, clé ou secret n’a été affiché. `sudo` n’a pas été invoqué de manière interactive ni contourné. Le contrôle `sudo -n true` a échoué avec `sudo: a password is required`.

## 2. Inventaire des conteneurs et montages

Sortie d’état issue de `docker inspect` :

| Conteneur | État | Code sortie | OOM | Démarré (UTC) | Arrêté (UTC) |
|---|---|---:|---|---|---|
| `peer0.org1.example.com` | `exited` | 255 | false | 2026-11-04 10:49:03.918 | 2026-11-04 22:56:07.406 |
| `peer0.org2.example.com` | `exited` | 255 | false | 2026-11-04 10:49:03.913 | 2026-11-04 22:56:07.409 |
| `orderer.example.com` | `exited` | 255 | false | 2026-11-04 10:49:03.932 | 2026-11-04 22:56:07.406 |

### Tableau détaillé des montages inspectés

| Conteneur | Type | Volume/source | Destination | Pertinence ledger / observation |
|---|---|---|---|---|
| Peer Org1 | volume anonyme | `96ed2cc…9352` | `/var/hyperledger` | Volume parent; certains chemins enfants sont recouverts par des montages plus spécifiques. |
| Peer Org1 | volume nommé | `compose_peer0.org1.example.com` | `/var/hyperledger/production` | Chemin attendu de données peer, dont `ledgersData`; montage enfant. |
| Peer Org1 | bind | peer Org1 sous `organizations/peerOrganizations/.../peers/peer0.org1.example.com` | `/etc/hyperledger/fabric` | Configuration/identité, pas le volume ledger. |
| Peer Org1 | bind | `compose/docker/peercfg` | `/etc/hyperledger/peercfg` | Configuration peer. |
| Peer Org1 | bind | `/var/run/docker.sock` | `/host/var/run/docker.sock` | Bind signalé `rw=true`; non utilisé pendant l’audit. |
| Peer Org2 | volume anonyme | `0944a834…2e43` | `/var/hyperledger` | Volume parent; certains chemins enfants sont recouverts par des montages plus spécifiques. |
| Peer Org2 | volume nommé | `compose_peer0.org2.example.com` | `/var/hyperledger/production` | Chemin attendu des données peer, dont `ledgersData`; montage enfant. |
| Peer Org2 | bind | peer Org2 sous `organizations/peerOrganizations/.../peers/peer0.org2.example.com` | `/etc/hyperledger/fabric` | Configuration/identité, pas le volume ledger. |
| Peer Org2 | bind | `compose/docker/peercfg` | `/etc/hyperledger/peercfg` | Configuration peer. |
| Peer Org2 | bind | `/var/run/docker.sock` | `/host/var/run/docker.sock` | Bind signalé `rw=true`; non utilisé pendant l’audit. |
| Orderer | volume anonyme | `72c5a37c…2c5` | `/var/hyperledger` | Volume parent; `/production/orderer` est recouvert par le volume nommé et MSP/TLS par des binds. |
| Orderer | volume nommé | `compose_orderer.example.com` | `/var/hyperledger/production/orderer` | Chemin attendu de la persistance orderer/Raft. |
| Orderer | bind | `organizations/ordererOrganizations/.../orderer.example.com/msp` | `/var/hyperledger/orderer/msp` | MSP, non assimilé à des blocs du ledger. |
| Orderer | bind | `organizations/ordererOrganizations/.../orderer.example.com/tls` | `/var/hyperledger/orderer/tls` | TLS, non assimilé à des blocs du ledger. |
| Orderer | volume anonyme | `bf5f729b…b7a0` | `/etc/hyperledger/fabric` | Configuration de l’orderer, pas son chemin de ledger. |

Les IDs anonymes complets sont disponibles dans le tableau de volumes ci-dessous. Les destinations et sources proviennent des enregistrements Docker, et non d’une inspection du contenu à l’intérieur des volumes.

### Chevauchement des montages

- **Peers :** le volume nommé monté sur `/var/hyperledger/production` masque à cet emplacement le sous-répertoire `production` qui pourrait exister dans le volume parent anonyme `/var/hyperledger`. Le chemin effectif `/var/hyperledger/production/ledgersData` relève donc du volume nommé du peer.
- **Orderer :** le volume nommé monté sur `/var/hyperledger/production/orderer` recouvre ce sous-chemin du volume parent anonyme `/var/hyperledger`. Les binds `/var/hyperledger/orderer/msp` et `/var/hyperledger/orderer/tls` recouvrent séparément ces chemins. Le contenu hors de ces sous-chemins reste fourni par le volume parent.
- Ces montages imbriqués déterminent quel volume fournit un chemin lorsqu’un conteneur est monté. Ils ne prouvent pas que le parent contient des copies masquées, ni que des données ont été perdues.

## 3. Volumes et tailles rapportées par Docker

Dates et labels : `docker volume inspect` rapporte tous les volumes listés ci-dessous créés le `2026-11-04 11:49:03 +01:00`. Les trois volumes nommés portent des labels Compose liant leur nom logique au service correspondant. Les volumes anonymes portent le label `com.docker.volume.anonymous`.

Tailles : valeurs produites par `docker system df -v`. C’est l’usage disque rapporté par Docker, pas une mesure des seuls fichiers de blocs.

| Conteneur | Volume | Type | Destination | Taille Docker |
|---|---|---|---|---:|
| Peer Org1 | `compose_peer0.org1.example.com` | nommé | `/var/hyperledger/production` | 163 kB |
| Peer Org1 | `96ed2cc745e42fbff5fae009e43446946feaffb68001a7053ccac787a5459352` | anonyme | `/var/hyperledger` | 0 B |
| Peer Org2 | `compose_peer0.org2.example.com` | nommé | `/var/hyperledger/production` | 163 kB |
| Peer Org2 | `0944a834fece0335871314aaaa0a5865e581f8b0a359485a373c91ec2fc2e43` | anonyme | `/var/hyperledger` | 0 B |
| Orderer | `compose_orderer.example.com` | nommé | `/var/hyperledger/production/orderer` | 128,1 MB |
| Orderer | `72c5a37ce1bbb473aa4242b72de7781a62f5e8e4158c36a03c6ea504928fd2c5` | anonyme | `/var/hyperledger` | 0 B |
| Orderer | `bf5f729b593ef88b21f77d095f378b62be95eb5c9e7b06f1fde18a630964b7a0` | anonyme | `/etc/hyperledger/fabric` | 49,77 kB |

Les deux volumes nommés des peers ont la même taille rapportée. Cela ne démontre ni l’égalité de leurs fichiers ni la synchronisation de leur état. Le volume de l’orderer est nettement plus volumineux; cela ne prouve pas à lui seul la présence d’un ledger sain. La taille `0 B` d’un volume anonyme parent ne décrit pas le volume nommé enfant qui couvre `/production`.

## 4. Inspection des fichiers persistants

Les chemins hôtes examinés étaient :

```text
/var/lib/docker/volumes/compose_peer0.org1.example.com/_data
/var/lib/docker/volumes/compose_peer0.org2.example.com/_data
/var/lib/docker/volumes/compose_orderer.example.com/_data
/var/lib/docker/volumes/96ed2cc745e42fbff5fae009e43446946feaffb68001a7053ccac787a5459352/_data
/var/lib/docker/volumes/0944a834fece0335871314aaaa0a5865e581f8b0a359485a373c91ec2fc2e43/_data
/var/lib/docker/volumes/72c5a37ce1bbb473aa4242b72de7781a62f5e8e4158c36a03c6ea504928fd2c5/_data
```

Le compte courant est UID 1000. Les contrôles `test -r` ont échoué pour les six chemins. Les chemins attendus `.../ledgersData` des peers et le répertoire orderer `.../_data/orderer` ont également été signalés inaccessibles; ce résultat **n’indique pas qu’ils sont absents**. Aucune commande de parcours des fichiers n’a donc pu produire un inventaire.

| Élément demandé | Résultat direct | Interprétation |
|---|---|---|
| Fichiers de blocs du canal | Non inspectés | Présence/absence actuelle non vérifiable. |
| Fichiers d’index/blocstore | Non inspectés | Format et intégrité non vérifiés. |
| LevelDB ou CouchDB | Non inspectés | Type de state database et fichiers non confirmés. |
| Snapshots | Non inspectés | Présence, contenu et dates inconnus. |
| Données Raft/orderer | Non inspectées | Le volume orderer est monté et Docker rapporte 128,1 MB, mais les fichiers ne sont pas identifiés. |
| Lifecycle et données chaincode | Non inspectées | Non confirmées par parcours de fichiers. |
| Dates de modification des contenus | Non disponibles | Seules les dates de création Docker des volumes sont observées. |
| Comparaison de contenu Org1/Org2 | Non disponible | La taille identique de 163 kB n’est pas une comparaison de fichiers. |

## 5. Journaux Docker disponibles : traces historiques

Les commandes `docker logs --tail 200 --timestamps` ont fourni des journaux datés du démarrage du 4 novembre, pas un état interrogé en direct du ledger. Extraits pertinents :

- **Peer Org1 :** à `2026-11-04T10:50:43.216Z`, `kvledger` journalise `Committed block [4]` sur `sfdchannel`.
- **Peer Org2 :** à `2026-11-04T10:50:43.220Z`, `kvledger` journalise `Committed block [4]` sur `sfdchannel`.
- **Orderer :** à `2026-11-04T10:50:43.179Z`, `etcdraft` journalise `Writing block [4] ... to ledger channel=sfdchannel`, avec `Raft index: 6`.
- Les dernières lignes visibles mentionnent aussi des RPC `context canceled` associées à des appels client interrompus; ces messages sont antérieurs de plus de douze heures à l’arrêt à 22:56 UTC.
- Aucun message explicite d’erreur de stockage n’apparaît dans les dernières lignes affichées. L’ensemble des journaux n’a pas été analysé exhaustivement et ces extraits ne permettent pas d’exclure des erreurs plus anciennes ou non affichées.

Ces journaux constituent une preuve d’activité passée jusqu’au bloc 4 dans les processus de l’époque. Ils ne confirment pas que les fichiers actuels contiennent ces blocs, ni qu’ils sont complets ou non corrompus.

## 6. Tableau de conclusion par composant

| Composant | Volume associé | Chemin de stockage pertinent | Fichiers trouvés | Taille | État de vérification | Limites |
|---|---|---|---|---:|---|---|
| Peer Org1 | `compose_peer0.org1.example.com` | conteneur `/var/hyperledger/production/ledgersData`; chemin hôte `_data/ledgersData` | Aucun fichier directement listé; journal historique : commit canal `sfdchannel`, bloc 4 | 163 kB selon Docker | **Partiellement vérifié** : attachement et activité historique confirmés; contenu inaccessible | Aucun listing/hash de blocs, index, state DB ou snapshot; volume parent anonyme séparé et masqué sous `/production`. |
| Peer Org2 | `compose_peer0.org2.example.com` | conteneur `/var/hyperledger/production/ledgersData`; chemin hôte `_data/ledgersData` | Aucun fichier directement listé; journal historique : commit canal `sfdchannel`, bloc 4 | 163 kB selon Docker | **Partiellement vérifié** : attachement et activité historique confirmés; contenu inaccessible | Aucune comparaison de fichiers avec Org1; même taille n’établit pas la synchronisation. |
| Orderer | `compose_orderer.example.com` | conteneur `/var/hyperledger/production/orderer` | Aucun fichier directement listé; journal historique : écriture du bloc 4, Raft index 6 | 128,1 MB selon Docker | **Partiellement vérifié** : attachement et activité Raft historique confirmés; contenu inaccessible | Aucun fichier bloc/segment/Raft directement inspecté; volumes anonymes parent et config ne sont pas le volume nommé du chemin orderer. |

## 7. Commandes à exécuter manuellement pour lever le blocage

`sudo -n true` a échoué avec `sudo: a password is required`. Je ne l’ai pas relancé avec un autre mécanisme. Si vous choisissez d’effectuer l’inspection dans votre terminal autorisé, la commande suivante ne lit que les métadonnées des entrées (type, taille, date de modification et chemin relatif); elle n’affiche pas le contenu des fichiers et ne les modifie pas :

```bash
sudo find \
  /var/lib/docker/volumes/compose_peer0.org1.example.com/_data \
  /var/lib/docker/volumes/compose_peer0.org2.example.com/_data \
  /var/lib/docker/volumes/compose_orderer.example.com/_data \
  -xdev -printf '%y %s %TY-%Tm-%TdT%TH:%TM:%TS %P\n'
```

Pour obtenir un inventaire par volume tout en conservant la séparation de chaque sortie :

```bash
for v in compose_peer0.org1.example.com compose_peer0.org2.example.com compose_orderer.example.com; do
  echo "=== $v ==="
  sudo find "/var/lib/docker/volumes/$v/_data" \
    -xdev -printf '%y %s %TY-%Tm-%TdT%TH:%TM:%TS %P\n'
done
```

Ces commandes ne doivent pas être complétées par `cat`, copie, déplacement, réparation ou montage en écriture. La présence et le format des fichiers pourront ensuite être évalués à partir de la sortie de métadonnées; établir l’intégrité cryptographique des blocs nécessiterait des vérifications supplémentaires, toujours en lecture seule et approuvées.

## Conclusion explicite

**Données persistantes non vérifiables avec les permissions disponibles.**

Preuves disponibles : les volumes existent selon Docker, sont attachés aux chemins indiqués, et Docker rapporte leurs tailles; les journaux historiques attestent des commits des deux peers jusqu’au bloc 4 et l’écriture du bloc 4 par l’orderer. Preuves manquantes : listing et métadonnées des fichiers internes, fichiers de blocs effectivement présents, index, snapshots, state database, données Raft et comparaison du contenu Org1/Org2. Aucune conclusion de perte ou d’intégrité du ledger n’est établie.
