# STATUS — État réel du projet

**Dernière inspection documentaire :** 2026-11-18  
**Dépôt :** `sudomarc/verify-check`  
**Branche de référence inspectée :** `main`  
**Dernier commit observé :** `bcf56bc87b5a7a2b38fe00cbb9cfc1ea349fc25b` — optimisation de l'interface pour la connectivité faible (#37, 2026-11-16).

> Ce fichier est un instantané. Le code et l'état réel des services restent prioritaires. Une fonctionnalité présente dans le dépôt n'est pas nécessairement validée sur un appareil ou dans la base distante.

## État général

Le socle web, le scanner PWA, le dashboard connecté aux API, les cartes QR, les services Scolarité/Comptabilité et le client mobile Expo sont présents dans `main`. Le projet n'est **pas encore validé de bout en bout sur un appareil réel avec une session administrateur réelle**.

### Changements récents observés dans `main`

- **#32 — Absences et export :** vue Absences, export CSV et impression.
- **#35 — Historique élève :** historique réel des scans, filtre cours propagé à l'export.
- **#36 — Scolarité et Comptabilité :** logique métier, API, vues dashboard, tests et migrations SQL ajoutés.
- **#37 — Connectivité faible :** BarcodeDetector natif prioritaire, chargement différé de `html5-qrcode`, cache du scanner et des QR, conservation en mémoire des vues financières et bouton Réessayer.

Le dashboard contient actuellement les vues « Vue générale », « Absences », « Classes », « Cours », « Élèves », « Cartes QR », « Scolarité » et « Comptabilité ».

## Rôle 1 — Backend, données, sécurité et intégration

### Fait dans le code / intégré

- Schéma principal, tables de présence et politiques RLS admin.
- Auth admin web, protection des routes, renouvellement et révocation de session.
- API de scan et règles métier : cours/salle, horodatage serveur, anti-doublon et erreurs explicites.
- API dashboard, historique, filtres et export CSV.
- Auth Bearer pour le client mobile sur les routes API concernées, en conservant les cookies web.
- Services Scolarité et Comptabilité : logique métier, API, interfaces raccordées et tests présents dans le dépôt.

### Restant / bloquant

- [ ] **Bloquant humain :** créer le compte administrateur Supabase Auth et définir son rôle dans `app_metadata`. Aucun identifiant ou mot de passe ne doit être conservé dans ce fichier.
- [ ] Vérifier les parcours authentifiés et les refus d'accès avec ce compte réel.
- [ ] **Migrations financières non appliquées selon les notes de conception :** obtenir la validation humaine des modèles, puis appliquer les migrations frais de scolarité et dépenses ; vérifier ensuite les tables et policies RLS dans la base distante.
- [ ] Vérifier l'état réel de la migration des niveaux/options/départements des classes dans Supabase ; la présence du fichier SQL ne prouve pas son application.
- [ ] Faire le test réel scan → insertion `attendance` → lecture dans le dashboard.

## Rôle 2 — Frontend, scanner, mobile, expérience et QA

### Fait dans le code / intégré

- PWA scanner connectée au backend, caméra navigateur, file IndexedDB hors ligne et états de synchronisation.
- Feedback sonore WebAudio et vibration implémentés dans `public/scanner/lib/feedback.js`, préférences activées par défaut.
- Dashboard réel : vues générales, absences, classes, cours, élèves/historique, cartes QR, Scolarité et Comptabilité.
- Génération/impression des cartes QR, filtres, export CSV et impression.
- Application mobile Expo : Auth Supabase, scanner natif, saisie manuelle, file hors ligne persistante et historique local.
- Optimisations de performance et de résilience réseau décrites dans le commit #37.

### Restant / non vérifié sur matériel réel

- [ ] Parcours navigateur authentifié complet, après création du compte admin.
- [ ] Test PWA sur téléphone réel : caméra, installation, cache hors ligne, synchronisation et reprise réseau.
- [ ] Test réel du son et de la vibration ; leur implémentation est présente, mais leur comportement matériel n'est pas confirmé.
- [ ] Test Expo Go sur téléphone : connexion, caméra, scan, file hors ligne et synchronisation.
- [ ] QA responsive/accessibilité et revue des erreurs sur toutes les vues, y compris les vues financières après activation des migrations.
- [ ] Jeu de données fictives et scénario de démonstration reproductible.
- [ ] Build Android signé : non réalisé/confirmé dans les éléments inspectés ; à faire uniquement si une distribution autonome est requise. Expo Go permet un test appareil sans attendre ce build.

## Vérifications et limites des preuves

- Le commit #37 indique que la syntaxe JavaScript, le typecheck, les tests et le build ont été vérifiés lors de son travail.
- Le statut combiné récupéré pour le SHA de `main` expose un contrôle Vercel en succès. Aucun workflow GitHub Actions n'a été retourné par la récupération des runs pour ce SHA ; je ne considère donc pas l'exécution GitHub Actions de ce commit comme indépendamment confirmée ici.
- Les notes du client mobile documentent un typecheck strict, 17 tests mobiles et `expo-doctor` 20/20 lors de l'implémentation. Cela ne remplace pas un test sur appareil physique.
- Les notes `docs/frais-scolarite.md` et `docs/comptabilite.md` déclarent les migrations financières non appliquées. Leur application distante n'est pas vérifiée.
- Aucune validation bout-en-bout avec un compte admin réel ni caméra physique n'est confirmée dans cette inspection.

## Documentation à réaligner

`ROADMAP.md` conserve encore plusieurs cases non cochées alors que des fonctionnalités correspondantes sont intégrées dans `main` (#32, #35, #36, #37). Il n'a pas été modifié dans cette mise à jour, limitée à `TEAM.md` et `STATUS.md`. Une PR documentaire distincte devra le réconcilier avec le code et les preuves, sans cocher une tâche sur la seule base d'une ancienne description.

## Règle de mise à jour

À chaque PR fusionnée ou session de travail significative, le rôle concerné met à jour sa section avec :
- le changement réellement intégré ;
- le commit/PR de référence ;
- les tests et vérifications réellement exécutés ;
- les points non testés et les blocages ;
- la prochaine action et son responsable.
