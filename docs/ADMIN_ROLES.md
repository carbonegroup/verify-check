# Rôles ADMIN / DEV et jeu de test UNIVIA

## Modèle d'autorisation

- **ADMIN** : opérations académiques (étudiants, cours, présence, scan, consultation).
- **DEV** : mêmes opérations, plus gestion des comptes, attribution des rôles, activation/désactivation, réinitialisation de mot de passe et lecture du journal d'audit.
- Un ADMIN ne peut pas créer de comptes ni modifier son rôle.
- Le dernier compte DEV actif ne peut pas être rétrogradé ni désactivé.
- Les autorisations serveur vérifient le JWT auprès de Supabase Auth. La migration ajoute aussi `public.app_user_roles`, lue par des fonctions privées RLS, afin que la désactivation/rétrogradation ne dépende pas uniquement de la durée de vie d'un ancien JWT.
- Les rôles d'autorisation ne sont jamais lus dans `user_metadata`.

## Configuration serveur obligatoire

Les routes de gestion des utilisateurs et le bootstrap initial utilisent la clé privilégiée Supabase. Définir dans les environnements **serveur uniquement** (Vercel Production/Preview et environnement local):

- `SUPABASE_SERVICE_ROLE_KEY`
- `AUTH_ACCOUNT_REDIRECT_URL`, par exemple `https://app.example.edu/auth/complete`

Ajouter l'URL HTTPS exacte dans **Supabase Auth → URL Configuration → Redirect URLs**. Vérifier que les modèles d'e-mail d'invitation et de réinitialisation respectent le `redirectTo` reçu (notamment s'ils utilisent une URL `SiteURL` codée en dur). Le même redirect est utilisé par l'interface publique de finalisation pour définir le mot de passe.

Ne jamais préfixer cette variable par `NEXT_PUBLIC_`, `EXPO_PUBLIC_`, ni la placer dans l'application mobile, un fichier commité ou un log.

## Initialiser le premier compte DEV

Avant le premier bootstrap, confirmer auprès du propriétaire l'adresse exacte de la boîte qui recevra l'invitation. Ne jamais corriger une adresse supposée à partir d'une faute de frappe ni créer un alias arbitraire. Le script synchronise le rôle dans `app_user_roles` et `app_metadata.role`; il peut aussi être relancé pour resynchroniser ces deux sources après une modification contrôlée du registre.

Après application de la migration, avec Node.js et les variables serveur disponibles:

```bash
BOOTSTRAP_DEV_EMAIL='adresse-verifiee@domaine-reel' \
CONFIRM_BOOTSTRAP_DEV_EMAIL='adresse-verifiee@domaine-reel' \
BOOTSTRAP_DEV_NAME='Développeur UCAO' \
node scripts/bootstrap-dev-user.mjs
```

Le script utilise également `AUTH_ACCOUNT_REDIRECT_URL` pour rediriger l'invitation vers le formulaire public de définition du premier mot de passe. Le script est idempotent sur l'adresse exacte: il retrouve le compte Auth ou envoie une invitation, inscrit le rôle dans `app_user_roles`, puis dans `app_metadata.role`. Aucun mot de passe temporaire n'est écrit, affiché ou commité. L'invitation dépend de la configuration SMTP Supabase. Si un compte existe déjà, le titulaire doit renouveler sa session après le changement de rôle.

## Jeu d'essai disponible toute la journée

La migration crée une classe clairement marquée `[TEST UNIQUEMENT] UNIVIA — disponibilité 24/7`, trois étudiants fictifs et sept cours quotidiens de 00:00 à 23:59 (un par jour de semaine). Ces lignes ont `is_demo = true`.

- Seul DEV peut voir et scanner ces données.
- Les requêtes normales du dashboard, les listes ADMIN et les données opérationnelles excluent les données de démonstration.
- Le mode de test DEV est explicite (`?demo=1`).
- Les codes QR sont des identifiants synthétiques dérivés de l'identifiant de la classe de test; ils ne représentent aucun étudiant réel.

Les données de test n'apparaîtront qu'après application de la migration. Elles ne sont pas insérées dans la base depuis le navigateur.

## Suppression définitive

L'archivage est l'opération normale et conserve les historiques. La suppression physique existe uniquement avec une confirmation textuelle explicite `SUPPRIMER DEFINITIVEMENT`. Le schéma actuel utilise des relations `ON DELETE CASCADE`: supprimer un étudiant ou un cours peut donc supprimer ses présences et, pour un étudiant, ses règlements associés. L'interface doit avertir l'utilisateur avant l'opération. Aucun nettoyage massif n'est exécuté automatiquement.

## Migration et séquence de mise en service

1. Sauvegarder la base de production.
2. Vérifier le diff de la migration `20261124190000_academic_management_dev_roles.sql` sur une base non productive.
3. Appliquer la migration dans le cadre du processus de déploiement validé.
4. Configurer `SUPABASE_SERVICE_ROLE_KEY` côté serveur.
5. Confirmer l'adresse du premier DEV et exécuter le script de bootstrap.
6. Vérifier la connexion DEV, l'accès aux écrans développeur et le scan d'un QR de démonstration.
7. Vérifier avec un compte ADMIN que les données de test et les fonctions de gestion des comptes restent inaccessibles.

Ne pas déployer les nouvelles routes avant l'application de la migration correspondante.


## Espace développeur dans le dashboard

- ADMIN et DEV partagent les vues de suivi et de gestion académique. Le menu affiche séparément le groupe technique DEV uniquement lorsque le rôle effectif renvoyé par `app_user_roles` est `dev`.
- Le groupe DEV expose des pages dédiées : espace développeur, comptes et rôles, jeux de test, journal d'audit détaillé et paramètres de l'application.
- La page Comptes et rôles permet les invitations, l'attribution des rôles, l'activation/désactivation et les demandes de réinitialisation. Le serveur et la base protègent le dernier DEV actif.
- La page Jeux de test bascule explicitement entre les données réelles et le jeu de démonstration isolé ; les données de test ne sont pas visibles aux comptes ADMIN.
- La page Journal d'audit détaillé permet de filtrer et lire les anciennes/nouvelles valeurs, alors que le tableau de bord commun n'affiche que le résumé d'activité.
- La page Paramètres de l'application est actuellement en lecture seule : `/api/admin/system` indique l'environnement et les états de configuration sans renvoyer de clé, valeur secrète ou URL de redirection. L'édition des secrets reste dans Vercel/Supabase.
- Le client récupère le rôle effectif via `/api/auth/context`, indépendamment du chargement des données académiques, afin qu'une erreur de données ne fasse pas disparaître le menu DEV.
- Les filtres de date, classe et cours ne sont rendus que dans les vues académiques qui les utilisent ; les écrans de comptes, d'audit, de jeux de test, de paramètres et de sécurité n'affichent pas ce bandeau.
