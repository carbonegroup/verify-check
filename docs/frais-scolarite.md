# Frais de scolarité — note de conception (proposition, 2026-11)

> Statut : **PROPOSITION — à valider par le mainteneur (Patrick)**.
> Aucun changement de schéma ni de code n'est inclus dans cette branche.
> Ce document décrit l'intention, les données minimales et les écrans, afin de
> valider l'approche **avant** toute implémentation.

## Objectif

Suivre, côté direction, l'état des **frais de scolarité** par élève et par
année scolaire : montant attendu, montant réglé, solde, échéances. Purement
**administratif** : ne touche ni au scan QR, ni aux présences.

## Principes (contraintes du projet)

- Budget **0 $** : uniquement services gratuits (Supabase free tier, Vercel).
- **Minimisation des données** : élèves possiblement mineurs → on ne stocke
  **aucune** donnée de paiement sensible (pas de numéro de carte, pas de
  coordonnées bancaires, pas de pièce d'identité). Uniquement des **montants**
  et un **statut**.
- Toute évolution de schéma nécessite la **validation humaine** (règle
  `AGENTS.md`) — c'est le but de cette note.
- Connexion faible : écrans légers, montants en **GNF** (franc guinéen),
  pas de dépendance lourde.

## Données minimales proposées (schéma NON appliqué)

Deux tables, dérivées du modèle existant (`students`, `classes`) :

```text
fees            (1 ligne = 1 frais attendu pour une classe / une période)
  id            uuid
  classe_id     uuid  -> classes(id)
  libelle       text        -- ex. « Scolarité T1 2026-2027 »
  annee_scolaire text       -- ex. « 2026-2027 »
  montant_gnf   integer     -- montant attendu (> 0)
  echeance      date        -- date limite indicative
  created_at    timestamptz

payments        (1 ligne = 1 règlement reçu pour un élève)
  id            uuid
  student_id    uuid  -> students(id)
  fee_id        uuid  -> fees(id)
  montant_gnf   integer     -- montant réglé (> 0)
  recu_le       date        -- date du règlement
  note          text null   -- référence libre (reçu papier, etc.)
  created_at    timestamptz
```

Règles de calcul (dérivées, **non stockées**) :

- `attendu(eleve, fee)` = `fees.montant_gnf` si l'élève est dans `fees.classe_id`.
- `regle(eleve, fee)` = somme des `payments.montant_gnf` correspondants.
- `solde` = `attendu - regle` ; statut = **réglé** (solde ≤ 0), **partiel**
  (0 < regle < attendu), **impayé** (regle = 0).
- Anti-doublon : un `payment` identique (même élève, même frais, même montant,
  même date) doit être signalé, sans le bloquer arbitrairement.

## Écrans envisagés (Direction)

1. Vue **Frais** : par classe et par période — attendu, réglé, solde, taux de
   recouvrement.
2. Vue **Élèves** : solde par élève, historique des règlements (montant + date).
3. **Export CSV** (mêmes filtres que l'export absences : classe / période) et
   **impression** de la liste des impayés.
4. Saisie d'un règlement (montant + date + note), avec confirmation.

## Sécurité / RLS

- `fees` et `payments` : **RLS activé**, accès **admin uniquement**
  (même politique que `classes` / `students` / `attendance`).
- Aucune lecture publique ; aucune donnée de paiement sensible.
- Suppression = **soft delete** envisagée (`deleted_at`) plutôt qu'un `delete`
  physique, pour l'auditabilité.

## Hors périmètre (v1)

- Pas de paiement en ligne / passerelle (budget 0 $, pas de données bancaires).
- Pas de rappels SMS/e-mail (coût, consentement).
- Pas de gestion de la cantine, du transport ou des fournitures.
- Pas de lien avec le scan/présence.

## Décisions à valider (Patrick)

1. Vocabulaire : **frais** par **classe** (simple) ou par **élève** (plus fin) ?
2. Granularité : une période (T1/T2/T3), un trimestre, ou un montant annuel ?
3. Un `fees` par classe suffit-il, ou faut-il des frais individuels (bourses,
   réductions) ?
4. Faut-il tracer l'**agent** qui saisit un règlement (audit) ?
5. Validation du schéma ci-dessus avant d'écrire la migration.

Une fois ces points tranchés, la suite : migration incrémentale + tables +
RLS + tests unitaires (règles de solde) + écran Direction.
