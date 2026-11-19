/**
 * Service scolarité — frais de scolarité (logique pure, testable sans base).
 *
 * Modèle (voir docs/frais-scolarite.md et supabase/migrations/2026-11-16_*) :
 * - un `frais` (fee) est ATTENDU pour une CLASSE sur une période ;
 * - un `reglement` (payment) est REÇU pour un ÉLÈVE.
 *
 * Minimisation des données (élèves possiblement mineurs) : uniquement des
 * montants en GNF (entiers) et des dates. Aucune donnée de paiement sensible
 * (pas de carte, pas de coordonnées bancaires, pas de pièce d'identité).
 */

import { csvEscape } from "./csv.ts";

/** Montant en GNF, séparateur de milliers insécable (affichage). */
export function formatGnf(montant: number): string {
  return `${Math.round(montant).toLocaleString("fr-FR")} GNF`;
}

export type ScolariteClasseRow = { id: string; nom: string };
export type ScolariteEleveRow = { id: string; nom: string; classe_id: string };

export type FraisRow = {
  id: string;
  classe_id: string;
  libelle: string;
  annee_scolaire: string;
  montant_gnf: number;
  echeance?: string | null;
};

export type ReglementRow = {
  id: string;
  student_id: string;
  fee_id: string;
  montant_gnf: number;
  recu_le: string; // date ISO (YYYY-MM-DD)
  note?: string | null;
};

/** Statut d'un élève vis-à-vis des frais attendus pour sa classe. */
export type StatutFrais = "regle" | "partiel" | "impaye" | "sans-frais";

export const STATUT_FRAIS_LABEL: Record<StatutFrais, string> = {
  regle: "RÉGLÉ",
  partiel: "PARTIEL",
  impaye: "IMPAYÉ",
  "sans-frais": "AUCUN FRAIS",
};

/**
 * Statut dérivé (jamais stocké) :
 * - `attendu` ≤ 0 → aucun frais défini pour la classe ;
 * - `regle` ≥ `attendu` → réglé ;
 * - 0 < `regle` < `attendu` → partiel ;
 * - `regle` = 0 → impayé.
 */
export function statutFrais(attendu: number, regle: number): StatutFrais {
  if (attendu <= 0) return "sans-frais";
  if (regle >= attendu) return "regle";
  if (regle > 0) return "partiel";
  return "impaye";
}

export type ScolariteLigne = {
  eleve_id: string;
  eleve: string;
  classe_id: string;
  classe: string;
  attendu_gnf: number;
  regle_gnf: number;
  solde_gnf: number;
  statut: StatutFrais;
};

export type ScolariteClasseResume = {
  classe_id: string;
  classe: string;
  eleves: number;
  attendu_gnf: number;
  regle_gnf: number;
  solde_gnf: number;
  /** Taux de recouvrement 0..1 (0 si aucun frais attendu). */
  taux: number;
};

export type ScolariteResult = {
  lignes: ScolariteLigne[];
  par_classe: ScolariteClasseResume[];
  totaux: {
    eleves: number;
    attendu_gnf: number;
    regle_gnf: number;
    solde_gnf: number;
    taux: number;
  };
};

/**
 * Agrège frais (par classe) + règlements (par élève) en lignes par élève,
 * résumé par classe et totaux. `solde = attendu - regle` (peut être négatif si
 * un trop-perçu a été enregistré ; on ne le masque pas, l'agent doit le voir).
 */
export function buildScolarite(
  raw: {
    classes: ScolariteClasseRow[];
    eleves: ScolariteEleveRow[];
    frais: FraisRow[];
    reglements: ReglementRow[];
  },
  filters: { classe?: string; statut?: StatutFrais } = {}
): ScolariteResult {
  const classeNom = new Map(raw.classes.map((c) => [c.id, c.nom]));

  // Attendu = somme des frais de la classe de l'élève.
  const attenduParClasse = new Map<string, number>();
  for (const f of raw.frais) {
    attenduParClasse.set(f.classe_id, (attenduParClasse.get(f.classe_id) ?? 0) + f.montant_gnf);
  }

  // Réglé = somme des règlements de l'élève.
  const regleParEleve = new Map<string, number>();
  for (const r of raw.reglements) {
    regleParEleve.set(r.student_id, (regleParEleve.get(r.student_id) ?? 0) + r.montant_gnf);
  }

  const eleves = raw.eleves.filter((e) => !filters.classe || e.classe_id === filters.classe);

  let lignes: ScolariteLigne[] = eleves.map((e) => {
    const attendu = attenduParClasse.get(e.classe_id) ?? 0;
    const regle = regleParEleve.get(e.id) ?? 0;
    return {
      eleve_id: e.id,
      eleve: e.nom,
      classe_id: e.classe_id,
      classe: classeNom.get(e.classe_id) ?? "",
      attendu_gnf: attendu,
      regle_gnf: regle,
      solde_gnf: attendu - regle,
      statut: statutFrais(attendu, regle),
    };
  });

  if (filters.statut) {
    lignes = lignes.filter((l) => l.statut === filters.statut);
  }

  lignes.sort(
    (a, b) => a.classe.localeCompare(b.classe, "fr") || a.eleve.localeCompare(b.eleve, "fr")
  );

  // Résumé par classe (recalculé sur les lignes filtrées).
  const parClasseMap = new Map<string, ScolariteClasseResume>();
  for (const l of lignes) {
    const agg =
      parClasseMap.get(l.classe_id) ??
      {
        classe_id: l.classe_id,
        classe: l.classe,
        eleves: 0,
        attendu_gnf: 0,
        regle_gnf: 0,
        solde_gnf: 0,
        taux: 0,
      };
    agg.eleves += 1;
    agg.attendu_gnf += l.attendu_gnf;
    agg.regle_gnf += l.regle_gnf;
    agg.solde_gnf += l.solde_gnf;
    parClasseMap.set(l.classe_id, agg);
  }
  const parClasse = [...parClasseMap.values()].sort((a, b) =>
    a.classe.localeCompare(b.classe, "fr")
  );
  for (const c of parClasse) c.taux = c.attendu_gnf > 0 ? c.regle_gnf / c.attendu_gnf : 0;

  const totaux = lignes.reduce(
    (acc, l) => {
      acc.eleves += 1;
      acc.attendu_gnf += l.attendu_gnf;
      acc.regle_gnf += l.regle_gnf;
      acc.solde_gnf += l.solde_gnf;
      return acc;
    },
    { eleves: 0, attendu_gnf: 0, regle_gnf: 0, solde_gnf: 0, taux: 0 }
  );
  totaux.taux = totaux.attendu_gnf > 0 ? totaux.regle_gnf / totaux.attendu_gnf : 0;

  return { lignes, par_classe: parClasse, totaux };
}

/** Export CSV des lignes (une par élève). BOM UTF-8 + CRLF (RFC 4180). */
export function buildScolariteCsv(lignes: ScolariteLigne[]): string {
  const lines: string[] = [
    ["eleve", "classe", "attendu_gnf", "regle_gnf", "solde_gnf", "statut"].map(csvEscape).join(","),
  ];
  for (const l of lignes) {
    lines.push(
      [
        l.eleve,
        l.classe,
        String(l.attendu_gnf),
        String(l.regle_gnf),
        String(l.solde_gnf),
        STATUT_FRAIS_LABEL[l.statut],
      ]
        .map(csvEscape)
        .join(",")
    );
  }
  return `\uFEFF${lines.join("\r\n")}`;
}

/**
 * Vrai si `candidat` est un doublon d'un règlement existant : même élève, même
 * frais, même montant et même date. Sert à prévenir (sans le bloquer
 * arbitrairement) une double saisie.
 */
export function isReglementDuplicate(
  existing: ReglementRow[],
  candidat: Pick<ReglementRow, "student_id" | "fee_id" | "montant_gnf" | "recu_le">
): boolean {
  return existing.some(
    (r) =>
      r.student_id === candidat.student_id &&
      r.fee_id === candidat.fee_id &&
      r.montant_gnf === candidat.montant_gnf &&
      r.recu_le === candidat.recu_le
  );
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Validation d'une saisie de règlement (avant insertion). */
export function validateReglement(input: {
  student_id?: string;
  fee_id?: string;
  montant_gnf?: number;
  recu_le?: string;
}): { ok: true } | { ok: false; error: string } {
  if (!input.student_id) return { ok: false, error: "eleve_requis" };
  if (!input.fee_id) return { ok: false, error: "frais_requis" };
  if (
    typeof input.montant_gnf !== "number" ||
    !Number.isFinite(input.montant_gnf) ||
    input.montant_gnf <= 0
  ) {
    return { ok: false, error: "montant_invalide" };
  }
  if (!input.recu_le || !ISO_DATE.test(input.recu_le)) {
    return { ok: false, error: "date_invalide" };
  }
  return { ok: true };
}
