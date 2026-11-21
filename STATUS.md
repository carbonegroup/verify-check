# STATUS — VerifyCheck

## Maintenance transversale — CI et distribution Android

Branche de correction précédente : `fix/ci-et-build-apk`.
Branche de correction actuelle : `fix/eas-production-build-type`.

### Problème EAS observé sur le run réel

- Le run APK `44940385438` a bien sélectionné le profil `preview`.
- EAS CLI `27.11.0` a néanmoins validé l'ensemble de `mobile/eas.json` et a rejeté `build.production.android.buildType = "aab"`.
- La valeur `aab` n'est pas une valeur valide du schéma EAS. Les valeurs acceptées sont `apk` et `app-bundle`.
- L'avertissement « Our services aren't available right now » concernait une opération de sauvegarde non bloquante ; le build s'est arrêté explicitement sur la validation de `eas.json`.
- Le patch des watchers `ENOSPC` s'est terminé avec succès et n'est pas la cause de cet échec.

### Corrections déjà intégrées dans main

- CI web/mobile : typechecks, lint, tests unitaires et build web.
- Configuration Expo dynamique `mobile/app.config.js` avec surcharge de version `APP_VERSION`, sans modification du working tree.
- Workflow APK : récupération de l'ID exact renvoyé par `eas build --no-wait --json`, attente du résultat, téléchargement et publication de l'artefact.
- Tests mobiles exécutés avec le runner natif Node.js, cohérent avec les fichiers `node:test`.
- Suppression des imports inutilisés et correction du placeholder Supabase de CI.

### Corrections dans la branche actuelle

- Remplacer `build.production.android.buildType: "aab"` par `"app-bundle"`, valeur EAS valide qui conserve le format App Bundle pour la production / Google Play.
- Retirer le profil `production` du sélecteur du workflow nommé « Build APK » : ce profil produit un App Bundle et ne doit pas être présenté comme un profil de génération APK.
- Ajouter un garde-fou dans le workflow pour refuser tout profil autre que `development` ou `preview`.
- Ajouter un contrôle CI qui valide les valeurs `android.buildType` de tous les profils EAS et vérifie que les profils utilisés pour publier l'APK résolvent bien vers APK.

### Vérification

- Run EAS en échec analysé : `44940385438`, profil observé : `preview`.
- CI complète précédente sur `main` : run `44940148557` réussie.
- La correction actuelle doit encore passer la CI de sa pull request.
- La nouvelle exécution réelle du workflow EAS reste à effectuer après intégration ; la génération et la publication APK ne sont donc pas encore vérifiées.

Aucune tâche fonctionnelle de la ROADMAP n'est déclarée terminée par cette maintenance.
