# STATUS — VerifyCheck

## Maintenance transversale — CI et distribution Android

Branche de correction : `fix/ci-et-build-apk`.

### Problèmes observés

- Le workflow APK appelait le package npm inexistant `expo-application-version`, ce qui provoquait une erreur 404.
- Le workflow APK utilisait `--output` pour un build distant, alors que cette option est réservée aux builds locaux, et ne reliait pas correctement l'URL d'artefact à l'étape de téléchargement.
- Le lint mobile signalait le fichier de configuration Jest CommonJS dans un paquet ESM et deux imports inutilisés dans `ScannerScreen.tsx`.
- Les tests mobiles utilisent `node:test`, mais le script lançait Jest. Jest tentait de transformer des dépendances React Native contenant de la syntaxe Flow et échouait avant d'exécuter les tests.
- Le build web CI utilisait une fausse clé Supabase rejetée par le validateur.
- La première solution de surcharge de version modifiait `app.json` avant `eas build`. EAS CLI refuse un working tree modifié en mode non interactif ; cette approche aurait donc fait échouer le build distant.

### Corrections apportées dans la branche

- Remplacer le package npm inexistant par une configuration Expo dynamique `mobile/app.config.js` qui surcharge `expo.version` depuis `APP_VERSION`, sans modifier les fichiers suivis.
- Récupérer le build EAS par plateforme, profil et SHA du commit ; attendre son statut final ; transmettre explicitement l'URL de l'artefact à l'étape de téléchargement.
- Supprimer l'option locale `--output` du build distant.
- Utiliser le runner natif Node.js pour les tests mobiles, cohérent avec les fichiers `node:test` et Node 22.
- Supprimer les imports inutilisés du scanner.
- Remplacer le faux placeholder Supabase du build CI par une valeur synthétique acceptée par le validateur ; aucune vraie clé n'est injectée.
- Ajouter une étape CI qui vérifie la configuration Expo par défaut et la surcharge `APP_VERSION`.

### Vérification

- Les runs initiaux sont documentés dans GitHub Actions : APK `44938334546` et CI PR #41 `44938270898`.
- Le commit précédent a passé toute la CI : run `44939523850` (typechecks, lint, tests web/mobile et build web).
- Le dernier ajustement de configuration Expo et du workflow APK doit encore passer la CI avant intégration.
- Le workflow EAS étant déclenché manuellement, la génération et la publication d'un APK doivent encore être exécutées et vérifiées.

Aucune tâche fonctionnelle de la ROADMAP n'est déclarée terminée par cette maintenance.
