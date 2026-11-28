# Contribuer à UNIVIA

## Flux de contribution
1. Mettre à jour `main` et créer une branche dédiée : `feat/*`, `fix/*`, `docs/*` ou `chore/*`.
2. Lire `AGENTS.md` et, pour le mobile, `mobile/AGENTS.md`.
3. Effectuer un changement ciblé et ajouter/adapter les tests nécessaires.
4. Exécuter les contrôles pertinents :
   - Web : `npm run typecheck`, `npm test`, `npm run lint`, `npm run build`.
   - Mobile : `cd mobile && npm run typecheck && npm test && npm run lint`.
   Vérifier les scripts présents dans le manifest avant exécution.
5. Relire le diff, documenter les résultats réels et ouvrir une PR vers `main`.
6. Attendre la CI et les revues requises. Ne pas merger une PR rouge ou une PR nécessitant une validation humaine non obtenue.

## Revue humaine obligatoire
Toute modification touchant le schéma SQL, les migrations, les politiques RLS, l'authentification, les secrets ou les données personnelles d'élèves doit être explicitement revue par le mainteneur avant merge.

## Sécurité
- Ne jamais commiter de secrets, tokens, clés privées ou fichiers d'environnement réels.
- Ne jamais placer une clé Supabase `service_role` dans du code client ou une variable publique.
- Utiliser exclusivement des données fictives dans les tests et exemples.
- Ne pas appliquer de migration ou modifier la base distante sans autorisation explicite.

## Pull requests
La description doit préciser : problème, solution, périmètre, tests réellement exécutés, limites et éventuels risques. Les changements de documentation doivent rester cohérents avec le code et la CI.
