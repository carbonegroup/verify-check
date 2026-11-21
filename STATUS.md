# STATUS — VerifyCheck

## Maintenance transversale — CI et distribution Android

Branche de correction : `fix/ci-et-build-apk`.

### Problèmes observés

- Le workflow APK appelait le package npm inexistant `expo-application-version`, ce qui provoquait une erreur 404.
- Le workflow APK utilisait `--output` pour un build distant, alors que cette option est réservée aux builds locaux, et ne reliait pas correctement l'URL de l'artefact à l'étape de téléchargement.
- Le lint mobile signalait le fichier de configuration Jest CommonJS dans un paquet ESM et deux imports inutilisés dans `ScannerScreen.tsx`.
- Les tests mobiles utilisent `node:test`, mais le script lançait Jest. Jest tentait de transformer des dépendances React Native contenant de la syntaxe Flow et échouait avant d'exécuter les tests.
- Le build web CI utilisait un faux placeholder Supabase rejeté par le validateur.
- La surcharge de version ne doit pas modifier `app.json`, car EAS refuse un working tree modifié en mode non interactif.
- Une recherche EAS par commit et profil peut sélectionner un ancien build lors de plusieurs déclenchements sur le même commit.

### Corrections apportées dans la branche

- Remplacer le package npm inexistant par une configuration Expo dynamique `mobile/app.config.js` qui surcharge `expo.version` depuis `APP_VERSION`, sans modifier les fichiers suivis.
- Importer explicitement `process` depuis `node:process` pour respecter le lint.
- Récupérer directement l'objet du build exact créé par la commande `eas build --no-wait --json` et transmettre son ID à l'étape d'attente ; ne plus rechercher le build via une liste potentiellement ambiguë.
- Supprimer l'option locale `--output` du build distant ; attendre le statut final et transmettre explicitement l'URL de l'artefact au téléchargement.
- Utiliser le runner natif Node.js pour les tests mobiles, cohérent avec les fichiers `node:test` et Node 22.
- Supprimer les imports inutilisés du scanner.
- Remplacer le faux placeholder Supabase du build CI par une valeur synthétique acceptée par le validateur ; aucune vraie clé n'est injectée.
- Ajouter une étape CI qui valide la configuration Expo par défaut et la surcharge `APP_VERSION`.

### Vérification

- Les runs initiaux sont documentés dans GitHub Actions : APK `44938334546` et CI PR #41 `44938270898`.
- Le commit précédent a passé la CI complète, mais la revue et le lint ont révélé les derniers ajustements ci-dessus.
- Le dernier contrôle CI a validé l'exécution de la configuration Expo, puis identifié un problème de lint résolu dans la branche ; le résultat de la CI couvrant également la corrélation exacte du build EAS reste à confirmer.
- Le workflow EAS est déclenché manuellement ; la génération et la publication d'un APK doivent encore être exécutées et vérifiées.

Aucune tâche fonctionnelle de la ROADMAP n'est déclarée terminée par cette maintenance.
