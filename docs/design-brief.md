# Design brief — VerifyCheck (refonte 2026-11)

## Contexte produit

Système de gestion des présences scolaires par QR code, Conakry (Guinée).
Trois surfaces : PWA de pointage (agent), dashboard web (direction), cartes élève imprimées.
Contraintes : connexion faible, budget 0 $, usages réels (pas de démo), données de mineurs minimisées.

## Trois directions comparées

### A. Registre scolaire contemporain — **RETENUE**

Métaphore : le registre d'appel de l'école, numérisé. Surface claire (papier),
typographie de registre (tabulaire, dense, lisible), accents d'encre (un seul
couleur d'accent « encre d'école »), tableaux et listes plutôt que cartes
statistiques. Les états métier (présent, non pointé, absent, en attente)
ressemblent aux annotations d'un registre, pas à des badges SaaS.
- Forces : immédiatement reconnaissable comme produit scolaire, très lisible en
  plein soleil, léger (pas d'effets), cohérent entre PWA, dashboard et cartes.
- Faiblesses : moins « spectaculaire » — voulu.

### B. Terminal de pointage professionnel

Métaphore : borne industrielle (badging d'usine). Dark mode, gros affichages
monospace, feedback sonore/visuel très sensoriel.
- Forces : très efficace pour l'écran scan seul.
- Faiblesses : transposer le dark mode au dashboard et aux cartes imprimées est
  incohérent ; un terminal sombre en plein jour sous climat tropical est
  contre-productif (écran chauffe, lisibilité). Rejeté comme direction
  globale, retenu ponctuellement pour l'écran scan (surfaces sombres autour de
  la caméra = meilleur contraste caméra).

### C. Tableau de suivi éditorial

Métaphore : bulletin/journal scolaire. Longues listes éditoriales, titres
serif, beaucoup de texte.
- Forces : élégant pour la consultation.
- Faiblesses : mal adapté à la saisie rapide et à l'action (scan), densité de
  lecture inutile pour l'agent. Rejeté.

## Direction retenue : A, avec B ponctuellement pour la zone caméra

### Palette (rôles sémantiques)

| Rôle | Valeur | Usage |
|---|---|---|
| `--paper` | #FAF7F0 | fond « papier » clair (toutes surfaces) |
| `--ink` | #1C2733 | texte principal (encre) |
| `--ink-soft` | #5B6B7C | texte secondaire |
| `--accent` | #14604A | vert école (actions, validation, en-têtes) |
| `--accent-ink` | #0C3D2F | accent survol/actif |
| `--warn` | #9A5B00 | non pointé / en attente |
| `--danger` | #A32E2E | absent, erreur métier |
| `--line` | #DCD5C8 | filets de tableau, séparateurs |
| `--scan-bg` | #12181F | uniquement autour de la caméra (direction B) |

Pas de dégradés, pas de verre, pas de halos. Une seule couleur d'accent.

### Typographie

- Titres et données : system-ui/« Segoe UI »/Roboto (pile système — zéro
  requête réseau, contexte de connexion faible).
- Nombres et codes (QR, horodatages) : pile monospace système (`ui-monospace`,
  Consolas, Menlo).
- Échelle : 12 / 14 / 16 / 20 / 28. Poids : 400 / 600 / 700.

### Espacements, grille, rayons

- Espacements : 4 px de base (4/8/12/16/24/32).
- Rayons : 4 px (champs, boutons), 8 px (panneaux). Pas de pill sauf états.
- Bordures : 1 px `--line`. Élévation : 0 par défaut ; 1 ombre légère
  (`0 1px 2px rgba(0,0,0,.12)`) uniquement pour les éléments superposés
  (modales, toasts).

### Composants

- Boutons : plein `--accent` (primaire), contour encre (secondaire), texte
  encre (tertiaire). Hauteur tactile ≥ 44 px sur PWA.
- Champs : fond papier, bordure `--line`, focus `--accent` 2 px.
- Tableaux : filets horizontaux seuls, en-tête en petites capitales encre
  douce, cellules numériques alignées à droite, tabular-nums.
- États métier : pastilles textuelles « PRESENT / NON POINTE / ABSENT /
  EN ATTENTE » — couleur + texte (jamais la couleur seule, accessibilité).

### Anti-vibe — décisions explicites

Aucun dégradé violet/bleu, aucun glassmorphism, aucune icône décorative, aucun
badge ornemental, aucun emoji d'interface, aucun « fade-in » générique.
La seule zone sombre est le cadre caméra du scanner (raison fonctionnelle :
contraste de lecture QR). Identité portée par la structure de registre
(tableaux, filets, encre) et non par des effets.


---

## Révision visuelle — référence de l'utilisateur (23 novembre 2026)

La première maquette fournie, **« VerifyCheck Attendance Dashboard and Mobile Scanner »**, devient la référence visuelle prioritaire pour le dashboard et le scanner Android. Cette décision remplace la palette papier/vert précédente pour ces deux surfaces. La seconde maquette violette de vérification d'identité ne fait pas partie du produit et doit être ignorée.

### Direction à reproduire

- Fond de travail bleu-gris très clair (#F3F6FA), panneaux blancs, bordures bleu-gris fines.
- Bleu marine (#17365D à #173F70) pour la marque, la navigation active, les actions primaires et les titres.
- Vert pour les présences confirmées, orange pour les états en attente ou les scans, rouge pour les absences et erreurs.
- Sidebar fixe d'environ 220 px sur desktop, en-tête supérieur blanc, titre de page, barre de filtres sur une ligne.
- Vue générale : quatre indicateurs (effectif, présents, scans, cours prévus), puis un registre tabulaire avec classe, cours, salle, horaire, présents et absents.
- Scanner Android : en-tête VerifyCheck bleu marine, caméra prioritaire avec repères de cadrage et navigation inférieure Accueil / Scanner / Historique. Aucun résumé de séance, compteur de présents ni saisie manuelle pendant le scan. La sélection classe/cours est une fenêtre ponctuelle accessible depuis les options du compte. Après une lecture, le résultat remplace la caméra avec le statut serveur, les informations élève disponibles et une action « Scanner le suivant ».
- Sur les écrans étroits, conserver l'ordre des tâches, permettre le défilement et éviter tout débordement horizontal hors tableaux défilants.

### Contrat fonctionnel inchangé

La maquette décrit la présentation, pas des données de démonstration. Tous les compteurs, horaires, classes, cours et statuts doivent provenir des réponses API et du modèle métier. Aucun chiffre de la maquette ne doit être copié. Une présence n'est confirmée qu'après réponse serveur ; hors ligne, elle reste explicitement en attente jusqu'à synchronisation.
