# VerifyCheck — application mobile

Application Android/iOS dédiée au pointage scolaire QR. Le serveur reste l'autorité pour l'identification de l'élève, le choix du cours et la validation de chaque présence.

## Parcours agent

- **Connexion** : authentification Supabase ; chaque appel API utilise le JWT de la session.
- **Scanner (écran par défaut)** : lecture QR avec la caméra arrière. L'agent n'a pas à sélectionner une classe ou une séance ; le backend identifie le contexte applicable à partir de la carte et des règles horaires.
- **Confirmation** : une prévisualisation présente les informations disponibles. L'agent confirme explicitement chaque pointage ; seul le retour serveur permet d'afficher CONFIRMÉ.
- **Scan continu facultatif** : après une confirmation serveur réussie, la caméra se réactive automatiquement. Les doublons, erreurs, ambiguïtés et scans hors ligne ne déclenchent pas la reprise automatique.
- **Commandes caméra** : flash/torche et zoom numérique lorsque le matériel les prend en charge.
- **Retour d'action** : vibration courte lors d'une confirmation ou d'un résultat nécessitant l'attention de l'agent.
- **État du serveur** : une barre supérieure indique si l'API est joignable. Ce contrôle vérifie l'accès au backend, pas simplement la présence d'un réseau Wi-Fi.
- **File hors ligne** : les tentatives non validées sont conservées localement en EN ATTENTE. La synchronisation automatique reprend les éléments qui disposent déjà d'un cours attribué ; ils ne deviennent confirmés qu'après réponse du serveur.
- **Scans hors ligne sans cours** : ils ne sont jamais affectés arbitrairement à une séance. L'agent doit rescanner lorsque le serveur est joignable afin que le backend détermine le cours.
- **Accueil agent** : résumé des pointages conservés localement sur l'appareil et raccourci vers le scanner.
- **Historique** : les 20 dernières entrées locales, filtrables par élève/QR, cours, date et statut. Ce n'est pas un registre global des présences de l'établissement.
- **Compte** : accès aux informations de base et déconnexion.

## Principes de sécurité et de cohérence

- Aucun pointage n'est affiché comme confirmé sur la seule base d'un enregistrement local.
- La file locale est conservée en cas d'erreur de stockage ou de perte de connexion ; l'application ne doit pas annoncer qu'un scan a été mis en attente si sa persistance a échoué.
- Les réponses d'accès refusé (403), de session expirée (401) et de requête invalide (400/404 non métier) ne sont pas transformées en pointages hors ligne.
- Un doublon renvoyé par le serveur est traité comme une présence déjà enregistrée, pas comme une nouvelle présence.
- Les scans sans cours identifié restent en attente et ne sont jamais rejoués sur une séance ultérieure par supposition.

## Structure

~~~text
mobile/
  App.tsx                         Shell, connexion, état serveur et onglets
  src/
    screens/
      LoginScreen.tsx             Connexion
      AccueilScreen.tsx           Activité locale de l'agent
      ScannerScreen.tsx           Caméra, prévisualisation et confirmation
      HistoriqueScreen.tsx        Historique local, filtres et synchronisation
    services/
      api.ts                      Appels API backend
      auth.ts                     Session Supabase
    store/
      scan.ts                     Persistance locale + orchestration
    lib/
      scanStatus.ts               Mapping des réponses serveur
      queue.ts                    File hors ligne (logique pure)
    tests/                        Tests unitaires de la file, des états et de la config
~~~

## Commandes

~~~bash
cd mobile
npm ci
npx expo start
npm run typecheck
npm test
npm run lint
~~~

## Configuration

Copier mobile/.env.example vers .env, puis définir :

- EXPO_PUBLIC_SUPABASE_URL
- EXPO_PUBLIC_SUPABASE_ANON_KEY
- EXPO_PUBLIC_API_BASE_URL

La clé Supabase service_role ne doit jamais être incluse dans l'application mobile.

## Limites de vérification

Les tests unitaires ne remplacent pas un essai de caméra sur un téléphone réel. Vérifier le flash, le zoom, les vibrations, le scan continu et le comportement hors ligne sur les appareils Android ciblés avant diffusion.
