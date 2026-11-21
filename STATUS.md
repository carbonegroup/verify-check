# STATUS — VerifyCheck

## Maintenance transversale — CI et distribution Android

Branche de correction précédente : fix/eas-production-build-type.
Branche de correction actuelle : fix/eas-project-link.

### Incidents EAS observés

- Le run 44940385438 sélectionnait le profil preview, mais EAS rejetait la valeur build.production.android.buildType = aab. Cette erreur a été corrigée dans main en utilisant app-bundle pour la production et en limitant le workflow APK aux profils development/preview.
- Le nouveau run manuel Build APK and Deploy to GitHub Pages (#3) passe maintenant la validation de eas.json et échoue au lancement du build avec EAS project not configured.
- La cause est l'absence de extra.eas.projectId dans la configuration Expo. Le fichier app.config.js étant dynamique, EAS CLI ne peut pas y injecter directement la liaison avec eas init.
- Les avertissements cache GitHub, punycode et disponibilité temporaire des services ne sont pas la cause de l'arrêt. L'avertissement appVersionSource manquant était non bloquant et est traité explicitement.

### Corrections déjà intégrées dans main

- CI web/mobile : typechecks, lint, tests unitaires et build web.
- Validation EAS de tous les buildType Android et des profils APK.
- Workflow APK : profils development/preview uniquement, récupération de l'ID exact renvoyé par EAS, attente du résultat, téléchargement et publication de l'artefact.
- Tests mobiles exécutés avec le runner natif Node.js, cohérent avec les fichiers node:test.

### Corrections dans la branche actuelle

- Déclarer marcopolos-team comme propriétaire Expo du projet verifycheck-mobile.
- Ajouter cli.appVersionSource = local dans eas.json pour expliciter le comportement déjà utilisé par défaut et supprimer l'avertissement de configuration.
- Ajouter une étape idempotente qui lie le projet EAS existant @marcopolos-team/verifycheck-mobile ou le crée s'il n'existe pas.
- Comme app.config.js est dynamique, déplacer temporairement ce fichier hors du dossier mobile pendant eas init afin que le CLI puisse enregistrer extra.eas.projectId dans app.json sur le runner, puis restaurer la configuration dynamique.
- Vérifier la configuration Expo résolue après restauration avant de lancer eas build.

### Vérification et limites

- Cause du nouveau run identifiée à partir de son log fourni : l'échec survient sur EAS project not configured, après la validation des profils et avant la création d'un build EAS.
- Le script de liaison utilise le compte marcopolos-team, déjà accessible au jeton EXPO_TOKEN observé dans le run.
- La CI de la pull request doit encore valider les modifications du dépôt.
- Aucun build APK n'est déclaré réussi : la nouvelle initialisation EAS et le téléchargement de l'APK devront être vérifiés lors de la prochaine exécution réelle du workflow.

Aucune tâche fonctionnelle de la ROADMAP n'est déclarée terminée par cette maintenance.
