# VerifyCheck

**Suivi de présence scolaire par QR code — Conakry, Guinée**

VerifyCheck est une application destinée aux établissements scolaires. Elle permet d'enregistrer les présences au début des cours à partir des cartes QR des élèves, puis de consulter les résultats depuis un espace réservé à la direction.

> **État du projet : MVP web ✅ TERMINÉ et déployable.** Le backend, l'API, le dashboard, la PWA scanner et l'authentification sont complets et testés. Il ne reste que la **validation terrain de l'app mobile Expo** (caméra, offline, sync, son/vibration) sur appareil Android réel.

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Architecture](#architecture)
- [Prérequis](#prérequis)
- [Installation web](#installation-web)
- [Configuration Supabase](#configuration-supabase)
- [Démarrage](#démarrage)
- [Application mobile](#application-mobile)
- [Tests et vérifications](#tests-et-vérifications)
- [Déploiement](#déploiement)
- [Sécurité et données](#sécurité-et-données)
- [Structure du dépôt](#structure-du-dépôt)
- [Contribution](#contribution)

## Fonctionnalités

### Présences et scanner

- Scanner les QR codes des cartes élèves depuis une caméra de navigateur (PWA).
- Authentifier le poste de pointage avec un compte administrateur.
- Sélectionner explicitement la classe et le cours à pointer.
- Associer un scan au cours actif selon l'heure locale de Conakry (Africa/Conakry).
- Enregistrer l'horodatage côté serveur.
- Détecter les QR inconnus, les cours inexistants ou ambigus, les salles incorrectes et les scans en doublon.
- Conserver les pointages en attente lorsque le serveur ou la base est indisponible, au lieu de les déclarer confirmés.

### Espace direction

- Connexion administrateur.
- Vue générale des présences et des effectifs.
- Consultation par classe, cours et élève.
- Filtrage par date, classe, cours ou élève.
- Consultation des cartes QR et de leurs informations.
- Export CSV des absences d'une journée.

Les statuts « présent », « non pointé » et « absent » sont distingués : un élève n'est considéré absent qu'une fois le cours terminé sans présence enregistrée.

### Application mobile

Le dossier `mobile/` contient un client React Native / Expo **code complete**. Il fournit l'authentification Supabase, le scan QR natif (expo-camera), la saisie manuelle et une file locale de synchronisation hors ligne avecAsyncStorage. **Le code est prêt ; il ne reste que la validation sur appareil Android réel** (caméra, mode offline, synchronisation, feedback son/vibration).

## Architecture

| Couche | Technologie |
| --- | --- |
| Application web et API | Next.js 15, React 19, TypeScript |
| Scanner web | PWA, caméra navigateur, html5-qrcode |
| Application mobile | React Native, Expo SDK 58, TypeScript |
| Authentification | Supabase Auth |
| Base de données | Supabase PostgreSQL |
| Accès aux données | Supabase JS, Row Level Security (RLS) |
| Génération des QR codes | qrcode |
| Hébergement web | Vercel |
| CI | GitHub Actions |

Le scanner, le dashboard et les clients mobiles s'appuient sur les règles métier et les endpoints du backend. Le serveur détermine le cours actif et valide l'enregistrement de la présence.

## Prérequis

Pour l'application web :

- Node.js 22 recommandé (version utilisée par la CI).
- npm.
- Un projet Supabase.
- Un navigateur récent ; l'accès caméra nécessite une permission navigateur et un contexte sécurisé (HTTPS en production, ou environnement local compatible).

Pour l'application mobile : les prérequis Expo et les instructions spécifiques sont documentés dans [mobile/README.md](mobile/README.md).

## Installation web

Cloner le dépôt et installer les dépendances :

~~~bash
git clone https://github.com/sudomarc/verify-check.git
cd verify-check
npm ci
~~~

Créer le fichier de configuration local à partir du modèle :

**Windows PowerShell**
~~~powershell
Copy-Item .env.example .env.local
~~~

**Linux / macOS**
~~~bash
cp .env.example .env.local
~~~

Renseigner les variables suivantes dans .env.local :

~~~dotenv
NEXT_PUBLIC_SUPABASE_URL=https://VOTRE-PROJET.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=VOTRE_CLE_PUBLIQUE_SUPABASE
~~~

Ces valeurs sont celles du projet Supabase, dans ses paramètres API. Le modèle .env.local.example contient des placeholders.

## Configuration Supabase

1. Créer ou sélectionner un projet Supabase.
2. Ouvrir le SQL Editor du projet.
3. Examiner puis exécuter le schéma versionné dans [supabase/schema.sql](supabase/schema.sql).
4. Vérifier que les tables, index et politiques RLS correspondent au schéma attendu.
5. Configurer les variables d'environnement web avec l'URL du projet et la clé publique.
6. Créer et autoriser le compte administrateur selon la procédure d'administration Supabase du projet.

Le modèle de données principal comprend :

- classes : classes scolaires ;
- students : élèves et codes QR ;
- courses : cours, horaires et salles ;
- attendance : enregistrements de présence.

**Important :** les politiques RLS limitent l'accès aux données. Le rôle administrateur est vérifié à partir de app_metadata.role. Ne remplacez pas ce contrôle par une valeur modifiable dans user_metadata. Toute évolution du schéma ou des règles d'accès doit être revue avant application.

## Démarrage

Lancer le serveur de développement :

~~~bash
npm run dev
~~~

Ouvrir [http://localhost:3000](http://localhost:3000).

Routes principales :

| Route | Description |
| --- | --- |
| / | Page d'accueil |
| /login | Connexion de la direction |
| /dashboard | Tableau de bord protégé |
| /scanner/ | Scanner PWA protégé |

## Application mobile

Consulter [mobile/README.md](mobile/README.md) pour la configuration détaillée.

En résumé :

~~~bash
cd mobile
npm ci
~~~

Créer mobile/.env à partir de mobile/.env.example, puis renseigner :

- EXPO_PUBLIC_SUPABASE_URL
- EXPO_PUBLIC_SUPABASE_ANON_KEY
- EXPO_PUBLIC_API_BASE_URL

Démarrer Expo :

~~~bash
npx expo start
~~~

Pour un téléphone physique sur le réseau local, EXPO_PUBLIC_API_BASE_URL doit pointer vers l'adresse IP accessible du serveur de développement, et non vers localhost.

Les variables EXPO_PUBLIC_* sont intégrées au bundle client : elles ne doivent contenir aucun secret. Ne jamais y placer une clé service_role.

## Tests et vérifications

**Web (✅ tout passe) :**
~~~bash
npm run typecheck
npm test
npm run build
~~~
- 101 tests unitaires passent
- TypeScript strict : 0 erreur
- ESLint (Next.js config) : 0 erreur/warning
- Build Next.js : succès

**Mobile (code prêt, tests locaux à faire) :**
~~~bash
cd mobile
npm install --legacy-peer-deps
npx tsc --noEmit
npm test
~~~

La CI GitHub Actions exécute ces vérifications sur les PR vers `main`.

> ⚠️ Un build réussi ne remplace pas un test du parcours réel sur appareil : authentification admin, autorisation caméra, scan QR, présence en base, dashboard.

## Déploiement

Le déploiement web cible Vercel, avec Supabase comme backend :

1. Importer le dépôt GitHub dans Vercel.
2. Configurer NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans les variables d'environnement Vercel.
3. Vérifier que le schéma et les politiques RLS sont appliqués dans Supabase.
4. Déployer une preview depuis une pull request.
5. Déployer la production depuis main, après revue et vérifications.

Ne pas ajouter de service payant sans décision explicite : le projet vise un fonctionnement avec les offres gratuites disponibles, dans leurs limites respectives.

## Sécurité et données

VerifyCheck traite des données relatives à des élèves, potentiellement mineurs. Le projet applique donc les principes suivants :

- collecter uniquement les informations nécessaires au suivi des présences ;
- ne pas stocker de photos d'élèves ;
- protéger les routes sensibles par authentification ;
- appliquer les politiques RLS dans Supabase ;
- ne jamais exposer de clé privée ou de clé service_role dans le navigateur, l'application mobile ou le dépôt ;
- conserver les fichiers .env.local et .env hors du contrôle de version ;
- ne déclarer un pointage confirmé qu'après validation du serveur.

En cas de doute sur les droits d'accès, vérifier le code backend et les politiques SQL avant toute mise en production.

## Structure du dépôt

~~~text
.
├── public/
│   └── scanner/          # PWA de pointage et ressources du scanner
├── src/
│   ├── app/              # Pages Next.js et routes API
│   ├── components/       # Composants de l'interface
│   └── lib/              # Auth, logique métier et accès Supabase
├── supabase/
│   └── schema.sql        # Schéma et règles de base de données
├── tests/                # Tests du backend et de la logique métier
├── mobile/               # Client React Native / Expo
├── .env.local.example    # Modèle de configuration web
└── package.json
~~~

## Contribution

- Lire [AGENTS.md](AGENTS.md) avant toute modification.
- Lire les instructions locales (AGENTS.md) dans le sous-dossier concerné.
- Créer une branche dédiée : feat/*, fix/* ou docs/*.
- Ouvrir une pull request vers main.
- Ajouter ou adapter les tests pour les changements métier.
- Ne jamais inclure de secrets, de données réelles d'élèves ou d'identifiants personnels dans les commits et les tests.

Toute modification du schéma de données, des politiques RLS ou des règles de traitement des données élèves doit être validée par le mainteneur du projet.
