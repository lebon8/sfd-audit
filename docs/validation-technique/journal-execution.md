# Journal d'exécution

Toutes les opérations de ce journal ont été en lecture seule vis-à-vis du réseau Fabric et des données métier, sauf la création locale des fichiers de preuves explicitement demandés et du jeu synthétique isolé.

1. Inspection du dépôt, des sources chaincode/middleware, du schéma PostgreSQL, des tests et configurations. Aucun `.env`, secret ou contenu de clé n'a été affiché.
2. `docker ps -a` et tests TCP : peer Org1/Org2 et orderer arrêtés; ports 7051/9051/7050 refusés. Aucun conteneur PostgreSQL visible; port 5432 refusé. CA Org1 active et port 7054 joignable.
3. Vérification des identités : chemins MSP configurés, répertoires `signcerts` et `keystore` présents avec un fichier attendu par rôle; certificat TLS du peer présent. Aucun secret affiché.
4. Depuis `middleware/`, lancement de `RUN_FABRIC_RBAC_TESTS=0 npm test -- --runInBand --testPathIgnorePatterns=tests/fabric-rbac.integration.test.js` : **10 suites réussies, 56 tests réussis, 0 échec**. Aucun test Fabric réel exécuté.
5. Exécution de `node docs/validation-technique/generate-audit-dataset.js` : dataset pré-étiqueté, 1 000 événements, 50 anomalies et 950 normaux. SHA-256 avant évaluation : `aa246e887058e49e15e3a0c2732fae0f6ab3b99c11903b195963970246e532db`.
6. Exécution de `node docs/validation-technique/evaluate-audit-dataset.js` sur ce dataset : 29 alertes; TP=50, FP=0, TN=950, FN=0; précision/rappel/F1=1. Ce résultat est spécifique au jeu synthétique.
7. `node --check` des deux scripts d'évaluation et `git diff --check` ont réussi.
8. Aucun test d'écriture/lecture ledger, test PostgreSQL, test de concurrence, suppression de données, déploiement, redémarrage de réseau ou benchmark n'a été tenté.
