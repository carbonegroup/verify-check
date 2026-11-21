# STATUS — VerifyCheck

## Maintenance transversale — CI et distribution Android

Branche de correction : `fix/ci-et-build-apk`.

### Problèmes observés

- Le workflow APK appelait le package npm inexistant `expo-application-version`, ce qui provoquait une erreur 404.
- Le workflow APK ne reliait pas correctement l'URL de l'artefact à l'étape de téléchargement et utilisait un identifiant de build ambigu.
- Le lint mobile signalait le fichier de configuration Jest CommonJS dans un paquet ESM, ainsi que deux imports inutilisés dans `ScannerScreen.tsx`.

### Corrections apportées dans la branche

- Mise à jour de `expo.version` dans `mobile/app.json` avec Node.js, sans dépendance npm tierce.
- Récupération du build EAS par plateforme, profil et SHA du commit ; attente du statut final ; transmission explicite de l'URL APK à l'étape de téléchargement.
- Migration de la configuration Jest vers `jest.config.mjs` et correction de `setupFilesAfterEnv`.
- Suppression des imports inutilisés du scanner.

### Vérification

- L'échec initial est documenté dans GitHub Actions : run APK `44938334546` et run CI de la PR #41 `44938270898`.
- Les vérifications du correctif doivent être confirmées par la CI de la pull request.
- Le workflow EAS étant déclenché manuellement, une nouvelle exécution de génération et publication APK reste à effectuer après intégration.

Aucune tâche fonctionnelle de la ROADMAP n'est déclarée terminée par cette maintenance.
