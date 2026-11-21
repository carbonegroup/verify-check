# STATUS — VerifyCheck

## Maintenance transversale — CI et distribution Android

Branche de correction : `fix/ci-et-build-apk`.

### Problèmes observés

- Le workflow APK appelait le package npm inexistant `expo-application-version`, ce qui provoquait une erreur 404.
- Le workflow APK ne reliait pas correctement l'URL de l'artefact à l'étape de téléchargement et utilisait un identifiant de build ambigu.
- Le lint mobile signalait le fichier de configuration Jest CommonJS dans un paquet ESM, ainsi que deux imports inutilisés dans `ScannerScreen.tsx`.
- Les tests mobiles utilisent `node:test`, mais le script lançait Jest. Jest tentait donc de transformer des dépendances React Native contenant de la syntaxe Flow et échouait avant d'exécuter les tests.
- Le build web CI utilisait une fausse clé Supabase qui ne respectait pas le format accepté par le validateur d'environnement.

### Corrections apportées dans la branche

- Mise à jour de `expo.version` dans `mobile/app.json` avec Node.js, sans dépendance npm tierce.
- Récupération du build EAS par plateforme, profil et SHA du commit ; attente du statut final ; transmission explicite de l'URL APK à l'étape de téléchargement.
- Utilisation du runner natif Node.js pour les tests mobiles, cohérent avec les fichiers `node:test` et la version Node 22 de la CI.
- Suppression des imports inutilisés du scanner.
- Remplacement de la fausse clé Supabase du build CI par une valeur synthétique commençant par `sb_publishable_` et conforme au validateur ; aucune vraie clé n'est injectée.

### Vérification

- Les runs initiaux sont documentés dans GitHub Actions : APK `44938334546` et CI PR #41 `44938270898`.
- Sur cette PR, typecheck web/mobile, lint web/mobile et tests unitaires web/mobile ont réussi. Le build web a ensuite révélé le format invalide du placeholder Supabase ; la correction du placeholder doit être confirmée par la CI relancée.
- Le workflow EAS étant déclenché manuellement, une nouvelle exécution de génération et publication APK reste à effectuer après intégration.

Aucune tâche fonctionnelle de la ROADMAP n'est déclarée terminée par cette maintenance.
