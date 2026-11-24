# Architecture produit — VerifyCheck (refonte 2026-11)

## Utilisateurs et tâches

### Agent de pointage (PWA mobile `public/scanner/`)
1. Connexion (email + mot de passe admin de la salle) → session cookie httpOnly same-origin.
2. Contexte de pointage : classe **et** cours du moment (choisis parmi les cours
   actifs réels du jour, Conakry) + salle optionnelle.
3. Scan → `POST /api/scan {code_qr, salle}` → réponse serveur → état métier affiché.
4. Saisie manuelle du code si carte endommagée/caméra HS.
5. Réglages : son, vibration. (La démo hors-ligne forcée et la réinitialisation
   disparaissent de l'interface de production.)
6. File hors ligne : pointages stockés en IndexedDB avec un id unique,
   affichés **EN ATTENTE** jusqu'à confirmation serveur ; synchronisation au
   retour du réseau ; un doublon renvoyé par le serveur est confirmé (pas une
   erreur bloquante).

### Direction (dashboard web `/dashboard`)
1. Vue générale du jour : planning réel (cours prévus), effectif, présences.
2. Vues Absences / Classes / Cours / Élèves + filtres date, classe, cours, élève.
3. Distinction : **présent** (scan serveur), **non pointé** (cours pas encore
   terminé), **absent** (cours terminé sans scan). Jamais « absent » pour un
   cours futur ou en cours.
4. Vue **Absences** : liste imprimable (élève × cours terminé sans scan) avec
   **export CSV** (filtres date / classe / cours) et **impression**
   (`window.print`, mise en page dédiée).
5. Vue **Élèves** : historique réel des scans (horodatage local Conakry).
   Le sélecteur **Cours** reste navigable grâce à `cours_disponibles` (tous les
   cours du jour de la classe, indépendamment du cours sélectionné).
6. Cartes : génération/impression des cartes QR depuis les élèves réels.
7. Vue **Scolarité** : frais par élève (attendu / réglé / solde / statut), filtre
   par classe et statut, export CSV + impression.
8. Vue **Comptabilité** : grand livre (recettes des frais + dépenses), solde et
   dépenses par catégorie, filtre par période, export CSV + impression.

### Élève (carte physique)
Identifiant scolaire, nom, classe, QR unique, identité visuelle école.
Aucune app élève. Le QR n'est pas une preuve d'identité : le serveur valide
code, cours actif, anti-doublon.

## Contrats API (inchangés sauf corrections listées)

- `POST /api/auth/login` / `POST /api/auth/logout` — session admin (cookies).
- `GET /api/dashboard?date&classe&cours&eleve` — données réelles du jour.
- `GET /api/dashboard/export?date&classe&cours` — CSV absences (cours terminés
  ou journée passée uniquement).
- `POST /api/scan {code_qr, salle?, cours?}` — le QR identifie l'élève et sa
  classe. Un cours actif unique est sélectionné automatiquement. Si plusieurs
  cours sont actifs, le serveur renvoie `cours_ambigu` et les candidats ;
  l'application mobile propose ce choix **après** le scan. `cours` reste
  optionnel pour les portiques ou pour confirmer un candidat. Aucun cours
  n'est choisi arbitrairement.
- `GET /api/scan/context` — **nouveau** : classes, cours du jour avec heures et
  statut actif (source de l'écran de contexte). Auth admin requise.

### Services financiers (2026-11)

- `GET /api/scolarite?classe&statut` — frais par élève (attendu / réglé / solde /
  statut), résumé par classe et totaux. Statut ∈ regle | partiel | impaye | sans-frais.
- `GET /api/scolarite/export?classe&statut` — CSV des frais (une ligne par élève).
- `POST /api/scolarite/reglement {student_id, fee_id, montant_gnf, recu_le, note?}`
  — enregistre un règlement ; un doublon (même élève + frais + montant + date)
  est inséré puis signalé (`doublon: true`).
- `GET /api/comptabilite?from&to` — grand livre (recettes des frais + dépenses),
  solde et dépenses par catégorie.
- `GET /api/comptabilite/export?from&to` — CSV du grand livre.
- `POST /api/comptabilite/depense {libelle, categorie, montant_gnf, date_depense, note?}`
  — enregistre une dépense.

### Évolution de schéma (v2, 2026-11)

Ajout de trois colonnes à `classes` (système guinéen) : `niveau` (maternelle /
primaire / college / lycee / universite), `option` (section, série ou
parcours/année) et `departement` (département universitaire, référentiel
générique sans nom d'établissement). Colonnes nullables, contraintes de
vocabulaire, index `classes_niveau_idx`. Aucun impact sur `students`,
`courses`, `attendance`, la RLS ni les données élèves.

- Migration incrémentale (base existante) : `supabase/migrations/2026-11-15_classes_niveaux_option_departement.sql`
- Schéma complet (nouvelle base) : `supabase/schema.sql` (v2)

### Évolution de schéma (v2.1 / v2.2, 2026-11) — services financiers

- **v2.1 — frais de scolarité** : tables `fees` (frais attendu par classe) et
  `payments` (règlement reçu par élève). Montants GNF (entiers > 0) + dates
  uniquement ; aucune donnée de paiement sensible. Solde et statut **dérivés**
  (`src/lib/scolarite.ts`), jamais stockés.
  Migration : `supabase/migrations/2026-11-16_frais_scolarite.sql`.
- **v2.2 — comptabilité** : table `expenses` (dépenses : libellé, catégorie,
  montant GNF, date). Recettes = `payments`. Solde **dérivé**
  (`src/lib/comptabilite.ts`).
  Migration : `supabase/migrations/2026-11-16_depenses.sql`.
- RLS activé, policies admin-only et privilèges `authenticated` identiques au
  reste du schéma ; aucun droit `anon`.

Les contrats API et le comportement runtime restent inchangés (les requêtes
`select id, nom from classes` continuent de fonctionner).

## Hors ligne (PWA)

- IndexedDB `vc-queue-v1` : file persistante de pointages non confirmés
  (id unique, code, cours, heure locale, tentatives).
- Un pointage sans serveur = **EN ATTENTE** (jamais « confirmé »).
- Synchronisation : au retour du réseau + à l'ouverture ; réponse `doublon`
  → confirmé en doublon ; `ok` → confirmé ; autre erreur → reste en file.
- Service worker : coquille minimale mise en cache **individuellement**
  (`allSettled`) pour que l'installation réussisse même si un fichier échoue en
  réseau instable ; navigations réseau-d'abord, assets en
  *stale-while-revalidate*.

## Performance et connectivité faible (2026-11)

Optimisations pour un usage léger à Conakry (réseau 2G/3G intermittent) :

- **Scan sans librairie** : le scanner utilise d'abord le décodage natif
  `BarcodeDetector` (Chrome/Android) — **aucun script à télécharger**. La
  librairie `html5-qrcode` (≈ 360 Ko) n'est chargée **qu'en repli** (navigateur
  sans `BarcodeDetector`), à la demande et mise en cache ensuite.
- **Cache HTTP long** des assets statiques du scanner (`max-age=604800,
  stale-while-revalidate`) ; `index.html` et `service-worker.js` restent
  toujours revalidés pour livrer les mises à jour.
- **Dashboard** : les vues financières (Scolarité, Comptabilité) gardent leur
  réponse en mémoire (pas de re-téléchargement au changement d'onglet) et
  offrent un bouton **Réessayer** en cas d'échec réseau, sans recharger la page.
- **QR des cartes** : réponse PNG cachée côté navigateur (`private, max-age=86400`)
  — le QR d'un code est déterministe, utile pour réimprimer une planche.
- Aucun fichier audio/image lourd : feedback sonore généré (WebAudio), polices
  système, icônes PNG < 7 Ko.
