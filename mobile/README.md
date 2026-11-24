# VerifyCheck — application mobile

Application Android/iOS de pointage scolaire. Le client utilise les endpoints du backend Next.js ; le serveur reste l’autorité pour chaque présence.

## Parcours

- **Connexion agent** : authentification Supabase ; chaque appel API utilise le JWT de la session.
- **Scanner (écran par défaut)** : l’écran est consacré à la caméra QR. La classe et le cours sont choisis dans une fenêtre ponctuelle accessible depuis les options du compte ; il n’existe plus d’onglet ou d’écran permanent « Contexte ».
- **Résultat après lecture** : après un scan, la caméra est remplacée par un résultat explicite. Le nom de l’élève et le cours sont affichés uniquement lorsque le serveur les fournit. L’action « Scanner le suivant » réactive la caméra.
- **Validation honnête** : une présence n’est confirmée qu’après la réponse serveur correspondante. Un doublon, un QR invalide, une séance incorrecte, une erreur serveur et une absence de réseau ont des messages distincts.
- **File hors ligne** : les pointages impossibles à valider sont conservés en local avec l’état **EN ATTENTE**. La synchronisation rejoue les éléments au serveur ; ils ne deviennent confirmés qu’après validation.
- **Accueil agent** : résumé des pointages conservés localement sur l’appareil et raccourci vers le scanner.
- **Historique** : les 20 dernières entrées locales, avec leur date et leur statut. Ce n’est pas un registre global des présences de l’établissement.

## Fonctionnalités volontairement retirées de l’écran de scan

- Carte de séance active affichée en permanence.
- Compteur de présents et effectif.
- Saisie manuelle du QR code.
- Onglet « Contexte » séparé.

Le choix de la séance reste obligatoire ; il est simplement déplacé dans une fenêtre afin de ne pas encombrer la caméra.

## Structure

~~~text
mobile/
  App.tsx                         Shell, authentification et onglets
  src/
    screens/
      LoginScreen.tsx             Connexion
      AccueilScreen.tsx           Activité locale de l’agent
      ScannerScreen.tsx           Caméra et résultat de scan
      HistoriqueScreen.tsx        Historique local + synchronisation
      SessionPicker.tsx           Sélection temporaire classe/cours
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
npm install
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

La clé Supabase service_role ne doit jamais être incluse dans l’application mobile.

## Limites de vérification

Les tests unitaires ne remplacent pas un essai de caméra sur un téléphone réel. Le parcours doit encore être contrôlé sur appareil physique avec un compte agent autorisé et une carte QR réelle.
