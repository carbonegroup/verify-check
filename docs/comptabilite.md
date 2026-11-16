# Comptabilité — note de conception (implémenté, 2026-11)

> Statut : **IMPLÉMENTÉ (code + migration fournis)** — migration **non appliquée**
> en base (validation humaine requise avant exécution SQL).
> Logique métier : `src/lib/comptabilite.ts` (tests : `tests/comptabilite.test.ts`).
> Migration : `supabase/migrations/2026-11-16_depenses.sql`.
> API : `/api/comptabilite`, `/api/comptabilite/export`, `/api/comptabilite/depense`.
> Vue dashboard : **Comptabilité**.

## Objectif

Offrir à la direction une vue financière simple : **recettes** (règlements de
frais de scolarité) et **dépenses** (saisies par la direction), avec un **solde**
et une répartition des dépenses par catégorie.

C'est le complément du service **Scolarité** (`docs/frais-scolarite.md`) : la
scolarité suit ce qui est **dû** par élève ; la comptabilité suit les **flux**
encaissés et dépensés.

## Principes (contraintes du projet)

- Budget **0 $** : services gratuits uniquement.
- **Minimisation** : libellé + montant GNF + date + catégorie. Aucun justificatif
  numérisé, aucune donnée bancaire, aucun numéro de pièce d'identité.
- Montants en **GNF** (entiers > 0).
- Toute évolution de schéma nécessite la **validation humaine** (AGENTS.md).

## Données (schéma appliqué après validation)

```text
expenses        (1 ligne = 1 dépense)
  id            uuid
  libelle       text        -- ex. « Carburant groupe »
  categorie     text        -- salaires | fournitures | entretien | transport | energie | loyer | autre
  montant_gnf   integer     -- > 0
  date_depense  date
  note          text null
  created_at    timestamptz
```

**Recettes** = table `payments` (règlements de frais, voir scolarité).

Règles de calcul (dérivées, **non stockées**) :

- `recettes` = somme des `payments.montant_gnf` sur la période ;
- `dépenses` = somme des `expenses.montant_gnf` sur la période ;
- `solde` = `recettes − dépenses` (négatif = déficit, affiché explicitement) ;
- `par_categorie` = dépenses regroupées par catégorie, triées décroissant.

Filtre de période **inclusif** `[from, to]` (dates ISO optionnelles).

## Écrans envisagés (Direction)

1. Vue **Comptabilité** : indicateurs (recettes / dépenses / solde / écritures),
   **grand livre** trié par date, **dépenses par catégorie**.
2. Filtre **période** (du / au).
3. **Export CSV** du grand livre + **impression**.
4. Saisie d'une dépense (libellé, catégorie, montant, date, note).

## Sécurité / RLS

- `expenses` : **RLS activé**, accès **admin uniquement** (même politique que
  `fees` / `payments`).
- Aucun droit `anon` ; aucune donnée sensible.

## Hors périmètre (v1)

- Pas de comptabilité en partie double, pas de plan comptable normé.
- Pas de TVA, pas de rapprochement bancaire, pas de paie détaillée.
- Pas de justificatifs numérisés ni de pièces jointes.
- Pas d'export comptable vers un logiciel tiers.

## Décisions à valider (Patrick)

1. Catégories de dépenses : la liste proposée suffit-elle ?
2. Faut-il tracer l'**agent** qui saisit une dépense (audit) ?
3. Une période par **année scolaire** ou par mois civil ?
4. Validation du schéma `expenses` avant d'écrire/appliquer la migration.
