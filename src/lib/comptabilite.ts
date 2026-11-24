/**
 * Service comptabilité — recettes (frais de scolarité) + dépenses → solde.
 * Logique pure, testable sans base ni réseau.
 *
 * Périmètre volontairement simple (budget 0 $, pas de données sensibles) :
 * - les RECETTES proviennent des règlements de frais (`payments`) ;
 * - les DÉPENSES sont saisies par la direction (`expenses`).
 * Le solde est DÉRIVÉ (jamais stocké) : solde = recettes − dépenses.
 *
 * Minimisation : montants en GNF (entiers) + dates + libellé. Aucune donnée
 * bancaire, aucune pièce jointe, aucun justificatif numérisé.
 */

import { csvEscape } from "./csv.ts";
import { formatGnf } from "./scolarite.ts";
import { isIsoDate } from "./dashboard.ts";

export type CategorieDepense =
  | "salaires"
  | "fournitures"
  | "entretien"
  | "transport"
  | "energie"
  | "loyer"
  | "autre";

export const CATEGORIE_DEPENSE_LABEL: Record<CategorieDepense, string> = {
  salaires: "Salaires",
  fournitures: "Fournitures",
  entretien: "Entretien",
  transport: "Transport",
  energie: "Énergie",
  loyer: "Loyer",
  autre: "Autre",
};

export const CATEGORIES_DEPENSE: CategorieDepense[] = [
  "salaires",
  "fournitures",
  "entretien",
  "transport",
  "energie",
  "loyer",
  "autre",
];

/** Une recette = un règlement de frais (montant + date). */
export type RecetteRow = {
  id: string;
  montant_gnf: number;
  recu_le: string; // date ISO (YYYY-MM-DD)
  libelle?: string | null;
};

/** Une dépense saisie par la direction. */
export type DepenseRow = {
  id: string;
  libelle: string;
  categorie: CategorieDepense;
  montant_gnf: number;
  date_depense: string; // date ISO (YYYY-MM-DD)
  note?: string | null;
};

export type EcritureType = "recette" | "depense";

/** Écriture unifiée pour le grand livre (recette ou dépense). */
export type Ecriture = {
  id: string;
  date: string;
  type: EcritureType;
  libelle: string;
  categorie: CategorieDepense | null;
  montant_gnf: number;
};

export type ComptabiliteResult = {
  ecritures: Ecriture[];
  par_categorie: Array<{ categorie: CategorieDepense; montant_gnf: number }>;
  totaux: {
    recettes_gnf: number;
    depenses_gnf: number;
    solde_gnf: number;
    nb_ecritures: number;
  };
};

/**
 * Fusionne recettes et dépenses en un grand livre trié (date décroissante),
 * filtré par période inclusive [from, to] (dates ISO, bornes optionnelles).
 */
export function buildComptabilite(
  raw: { recettes: RecetteRow[]; depenses: DepenseRow[] },
  filters: { from?: string; to?: string } = {}
): ComptabiliteResult {
  const inRange = (date: string) =>
    (!filters.from || date >= filters.from) && (!filters.to || date <= filters.to);

  const ecritures: Ecriture[] = [
    ...raw.recettes
      .filter((r) => inRange(r.recu_le))
      .map<Ecriture>((r) => ({
        id: `recette-${r.id}`,
        date: r.recu_le,
        type: "recette",
        libelle: r.libelle ?? "Frais de scolarité",
        categorie: null,
        montant_gnf: r.montant_gnf,
      })),
    ...raw.depenses
      .filter((d) => inRange(d.date_depense))
      .map<Ecriture>((d) => ({
        id: `depense-${d.id}`,
        date: d.date_depense,
        type: "depense",
        libelle: d.libelle,
        categorie: d.categorie,
        montant_gnf: d.montant_gnf,
      })),
  ];

  ecritures.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id.localeCompare(b.id)));

  const recettes_gnf = ecritures
    .filter((e) => e.type === "recette")
    .reduce((s, e) => s + e.montant_gnf, 0);
  const depenses_gnf = ecritures
    .filter((e) => e.type === "depense")
    .reduce((s, e) => s + e.montant_gnf, 0);

  const catMap = new Map<CategorieDepense, number>();
  for (const e of ecritures) {
    if (e.type === "depense" && e.categorie) {
      catMap.set(e.categorie, (catMap.get(e.categorie) ?? 0) + e.montant_gnf);
    }
  }
  const par_categorie = [...catMap.entries()]
    .map(([categorie, montant_gnf]) => ({ categorie, montant_gnf }))
    .sort((a, b) => b.montant_gnf - a.montant_gnf);

  return {
    ecritures,
    par_categorie,
    totaux: {
      recettes_gnf,
      depenses_gnf,
      solde_gnf: recettes_gnf - depenses_gnf,
      nb_ecritures: ecritures.length,
    },
  };
}

/** Export CSV du grand livre. BOM UTF-8 + CRLF (RFC 4180). */
export function buildComptabiliteCsv(ecritures: Ecriture[]): string {
  const lines: string[] = [
    ["date", "type", "libelle", "categorie", "montant_gnf"].map(csvEscape).join(","),
  ];
  for (const e of ecritures) {
    lines.push(
      [
        e.date,
        e.type,
        e.libelle,
        e.categorie ? CATEGORIE_DEPENSE_LABEL[e.categorie] : "",
        String(e.montant_gnf),
      ]
        .map(csvEscape)
        .join(",")
    );
  }
  return `\uFEFF${lines.join("\r\n")}`;
}

/** Maximum positif stockable par les colonnes PostgreSQL INTEGER. */
const MAX_GNF_AMOUNT = 2_147_483_647;

/** Validation d'une saisie de dépense (avant insertion). */
export function validateDepense(input: {
  libelle?: unknown;
  categorie?: unknown;
  montant_gnf?: unknown;
  date_depense?: unknown;
  note?: unknown;
}): { ok: true } | { ok: false; error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "corps_invalide" };
  }
  if (typeof input.libelle !== "string" || input.libelle.trim().length < 2) {
    return { ok: false, error: "libelle_requis" };
  }
  if (
    typeof input.categorie !== "string" ||
    !CATEGORIES_DEPENSE.includes(input.categorie as CategorieDepense)
  ) {
    return { ok: false, error: "categorie_invalide" };
  }
  if (
    typeof input.montant_gnf !== "number" ||
    !Number.isSafeInteger(input.montant_gnf) ||
    input.montant_gnf <= 0 ||
    input.montant_gnf > MAX_GNF_AMOUNT
  ) {
    return { ok: false, error: "montant_invalide" };
  }
  if (typeof input.date_depense !== "string" || !isIsoDate(input.date_depense)) {
    return { ok: false, error: "date_invalide" };
  }
  if (input.note !== undefined && input.note !== null && typeof input.note !== "string") {
    return { ok: false, error: "note_invalide" };
  }
  return { ok: true };
}

/** Résumé lisible du solde (affichage), signe explicite. */
export function libelleSolde(solde: number): string {
  if (solde === 0) return "Équilibré";
  return `${solde > 0 ? "Excédent" : "Déficit"} : ${formatGnf(Math.abs(solde))}`;
}
