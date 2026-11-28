# UNIVIA

**Pointage scolaire par QR code — Conakry, Guinée**

UNIVIA permet à un établissement d'enregistrer les présences par cours à partir des cartes QR des élèves et de consulter les résultats dans un espace réservé à la direction.

## Applications
- **Dashboard web** : Next.js App Router, TypeScript.
- **Scanner PWA** : caméra du navigateur, sélection du contexte de pointage et file hors ligne.
- **Application mobile** : React Native / Expo dans `mobile/`.
- **Backend** : routes API Next.js, Supabase Auth et PostgreSQL avec RLS.
- **Distribution Android** : workflow GitHub Actions qui construit un APK et publie un artefact / une release GitHub.
- **Hébergement web** : Vercel.

Les versions précises sont définies dans `package.json`, `mobile/package.json` et les lockfiles. Ne pas se fier à une version recopiée dans une documentation.

## Fonctionnalités principales
- Authentification de la direction et protection des routes.
- Pointage QR associé à une classe et un cours.
- Validation serveur, horodatage et protection contre les doublons.
- États explicites pour les QR invalides, erreurs et scans en attente.
- Consultation des présences par date, classe, cours et élève.
- Cartes QR, exports et modules administratifs présents dans le dashboard.
- Application mobile avec scan natif et synchronisation différée.

## Prérequis
- Node.js compatible avec la version utilisée dans `.github/workflows/ci.yml` (actuellement Node 22).
- npm.
- Projet Supabase configuré.
- Navigateur avec accès caméra pour le scanner PWA.

## Installation web
```bash
git clone https://github.com/sudomarc/verify-check.git
cd verify-check
npm ci
cp .env.example .env.local
```

Configurer dans `.env.local` :
```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://VOTRE-PROJET.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=VOTRE_CLE_PUBLIQUE
```

Puis démarrer :
```bash
npm run dev
```

Ouvrir http://localhost:3000.

## UNIVIA 2.0 — rôles et gestion académique

La migration `supabase/migrations/20261124190000_academic_management_dev_roles.sql` ajoute la gestion des élèves, cours, saisies/corrections de présence, rôles ADMIN/DEV, journal d'audit et un jeu de test 24/7 réservé au DEV.

Avant tout déploiement de cette version :
- sauvegarder puis tester la migration sur une base non-production ;
- appliquer la migration selon le processus de revue du projet ;
- ajouter `SUPABASE_SERVICE_ROLE_KEY` à l'environnement serveur (jamais dans `NEXT_PUBLIC_*` ou `EXPO_PUBLIC_*`) ;
- confirmer l'adresse exacte qui recevra le premier compte DEV ;
- exécuter `npm run admin:bootstrap-dev` avec `BOOTSTRAP_DEV_EMAIL` et `CONFIRM_BOOTSTRAP_DEV_EMAIL` identiques et vérifiés.

La migration n'est pas auto-appliquée au démarrage, et le compte DEV n'est pas créé automatiquement. Voir [docs/ADMIN_ROLES.md](docs/ADMIN_ROLES.md) et [docs/produit-architecture.md](docs/produit-architecture.md). N'utiliser la suppression physique qu'après confirmation explicite : l'historique lié peut être supprimé par les contraintes de cascade existantes.

## Base de données
Examiner le schéma de référence `supabase/schema.sql` et les migrations de `supabase/migrations/`. Vérifier les politiques RLS et les rôles avant toute mise en service. Ne pas appliquer de migration distante sans revue et autorisation du mainteneur.

## Application mobile
Consulter [mobile/README.md](mobile/README.md) et [mobile/AGENTS.md](mobile/AGENTS.md).

```bash
cd mobile
npm ci
npx expo start
```

Créer `mobile/.env` à partir de `mobile/.env.example` et configurer :
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_API_BASE_URL`

Les variables `EXPO_PUBLIC_*` sont intégrées au client. N'y placer aucun secret ni clé `service_role`.

## Vérifications
Web :
```bash
npm run typecheck
npm test
npm run lint
npm run build
```

Mobile :
```bash
cd mobile
npm run typecheck
npm test
npm run lint
```

La CI de pull request exécute les contrôles configurés dans `.github/workflows/ci.yml`. Un build ou des tests unitaires ne remplacent pas un essai de scan sur un appareil Android réel.

## Déploiement
Le dashboard web est déployé sur Vercel. La production doit provenir de `main` après revue et CI verte. Le workflow Android est défini dans `.github/workflows/build-apk.yml`; consulter ses exécutions pour récupérer l'artefact ou la release correspondante.

## Sécurité et données
Les élèves pouvant être mineurs :
- limiter les données personnelles au strict nécessaire ;
- ne pas stocker de photos d'élèves ;
- protéger les routes et tables par authentification et RLS ;
- ne jamais exposer de secret dans le client ou le dépôt ;
- utiliser uniquement des données fictives dans les tests ;
- ne déclarer un pointage confirmé qu'après validation serveur.

Toute modification du schéma, des politiques RLS, de l'authentification ou des données élèves exige une revue humaine.

## Structure
```text
.
├── .github/workflows/  # CI et build Android
├── docs/               # Architecture et décisions produit
├── mobile/             # Application Expo
├── public/scanner/     # PWA de pointage
├── src/                # Application Next.js, API et logique métier
├── supabase/           # Schéma et migrations SQL
└── tests/              # Tests web
```

## Contribution
Lire [AGENTS.md](AGENTS.md) et [CONTRIBUTING.md](CONTRIBUTING.md), créer une branche dédiée et ouvrir une PR vers `main`. Ne pas merger avant CI verte et revue humaine lorsque requise.
