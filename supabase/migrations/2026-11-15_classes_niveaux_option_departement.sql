-- VerifyCheck — migration schéma v2 (2026-11-15)
-- Évolution : niveaux (cycles) + option + département universitaire sur `classes`.
--
-- À exécuter manuellement dans l'éditeur SQL Supabase APRÈS validation humaine
-- (même convention que supabase/schema.sql).
--
-- Idempotente : réexécutable sans erreur (add column if not exists,
-- drop constraint if exists, create index if not exists).
--
-- Contexte — système guinéen :
--   Maternelle · Primaire · Collège · Lycée sont regroupés ; l'Université est à part.
--   Chaque classe porte une `option` : section (primaire/collège), série (lycée)
--   ou parcours/année (université). Pour l'université, `departement` porte le
--   département (filière) selon un référentiel GÉNÉRIQUE, sans nom d'établissement.
--
-- Portée : aucune donnée personnelle élève. Aucune table existante n'est
-- supprimée. RLS et policies inchangées (les colonnes ajoutées héritent des
-- droits/policies de `classes`).

-- ---------------------------------------------------------------------------
-- 1) Nouvelles colonnes (nullable : les lignes existantes ne sont pas cassées)
-- ---------------------------------------------------------------------------
alter table classes
  add column if not exists niveau text,       -- cycle de la classe
  add column if not exists option text,       -- section / série / parcours
  add column if not exists departement text;  -- département universitaire (niveau = universite)

-- ---------------------------------------------------------------------------
-- 2) Référentiel des niveaux (cycle)
-- ---------------------------------------------------------------------------
alter table classes drop constraint if exists classes_niveau_check;
alter table classes add constraint classes_niveau_check
  check (niveau is null or niveau in ('maternelle', 'primaire', 'college', 'lycee', 'universite'));

-- ---------------------------------------------------------------------------
-- 3) Référentiel GÉNÉRIQUE des départements universitaires
--    (aucun nom d'établissement ; faculté/domaine → département/filière)
-- ---------------------------------------------------------------------------
alter table classes drop constraint if exists classes_departement_check;
alter table classes add constraint classes_departement_check
  check (departement is null or departement in (
    -- Sciences et techniques
    'Mathématiques', 'Physique', 'Chimie', 'Biologie', 'Géologie', 'Informatique',
    -- Sciences de la santé
    'Médecine', 'Pharmacie', 'Odontologie', 'Sciences infirmières', 'Sage-femme', 'Santé publique',
    -- Ingénierie / polytechnique
    'Génie civil', 'Génie électrique', 'Génie mécanique', 'Génie informatique', 'Télécommunications',
    -- Sciences sociales et humaines
    'Sociologie', 'Psychologie', 'Histoire', 'Géographie',
    'Sciences de l''information et de la communication',
    -- Lettres et langues
    'Lettres modernes', 'Anglais', 'Langues nationales',
    -- Droit et sciences politiques
    'Droit privé', 'Droit public', 'Relations internationales',
    -- Économie et gestion
    'Économie', 'Gestion', 'Comptabilité-Finance',
    -- Agronomie et sciences vétérinaires
    'Agronomie', 'Foresterie', 'Sciences vétérinaires',
    -- Sciences de l'éducation
    'Sciences de l''éducation', 'Formation des enseignants',
    -- Mines et environnement
    'Génie minier', 'Sciences de l''environnement'
  ));

-- ---------------------------------------------------------------------------
-- 4) Cohérence : un département ne concerne que l'université
-- ---------------------------------------------------------------------------
alter table classes drop constraint if exists classes_departement_niveau_check;
alter table classes add constraint classes_departement_niveau_check
  check (departement is null or niveau = 'universite');

-- ---------------------------------------------------------------------------
-- 5) Index pour le regroupement par niveau (dashboard direction)
-- ---------------------------------------------------------------------------
create index if not exists classes_niveau_idx on classes (niveau);

-- ---------------------------------------------------------------------------
-- 6) Documentation en base
-- ---------------------------------------------------------------------------
comment on column classes.niveau is
  'Cycle : maternelle | primaire | college | lycee | universite (NULL si non renseigné).';
comment on column classes.option is
  'Section (primaire/collège), série (lycée) ou parcours/année (université). Ex. "A", "Sciences Mathématiques", "Licence 1".';
comment on column classes.departement is
  'Département universitaire (niveau = universite). Référentiel générique sans nom d''établissement — voir contrainte classes_departement_check.';

-- ---------------------------------------------------------------------------
-- Exemples d'usage (à titre indicatif, NON exécutés ici) :
--
--   insert into classes (nom, niveau, option, departement)
--   values ('Grande Section', 'maternelle', null, null),
--          ('6ème Année',     'primaire',   'A',  null),
--          ('7ème Année',     'college',    'A',  null),
--          ('11ème Année',    'lycee',      'Sciences Mathématiques', null),
--          ('Licence 1 Informatique', 'universite', 'Licence 1', 'Informatique'),
--          ('2ème année Médecine',    'universite', '2ème année', 'Médecine');
--
-- Note : le référentiel des départements est volontairement GÉNÉRIQUE (aucun nom
-- d'université). Pour ajouter un département, modifier la contrainte
-- classes_departement_check dans une nouvelle migration (ou la retirer si un
-- vocabulaire libre est préféré).
-- ---------------------------------------------------------------------------
