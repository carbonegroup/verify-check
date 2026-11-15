/**
 * Liste des absences (Sprint 3) — logique pure, testable sans base ni réseau.
 *
 * Règle métier unique, partagée avec l'export CSV et le dashboard :
 * un élève n'est ABSENT que pour un cours PRÉVU et DÉJÀ TERMINÉ sans scan.
 * Un cours futur ou en cours n'est jamais une absence (« non pointé »).
 */

import { minutesOf } from "./time.ts";

/** Instant scolaire courant, exprimé en minutes depuis minuit (Conakry). */
export type NowMinutes = { jour: string; minutes: number };

/**
 * Vrai si le cours est terminé relativement à l'instant scolaire courant.
 * - sans `now` (journée passée) : considéré terminé ;
 * - jour passé → terminé ; jour futur → non terminé ;
 * - jour même : terminé si `heureFin` est connue et déjà dépassée.
 */
export function isCourseFinished(
  date: string,
  heureFin: string | null | undefined,
  now?: NowMinutes
): boolean {
  if (!now) return true;
  if (date < now.jour) return true;
  if (date > now.jour) return false;
  if (!heureFin) return false; // heure inconnue → on ne déclare pas absent
  return minutesOf(heureFin) <= now.minutes;
}

export type AbsenceCours = {
  id: string;
  nom: string;
  classe_id: string;
  salle?: string | null;
  heure_debut: string;
  heure_fin?: string | null;
};

export type AbsenceEleve = {
  id: string;
  nom: string;
  classe_id: string;
  presences: Array<{ course_id: string }>;
};

export type AbsenceRow = {
  eleve_id: string;
  eleve: string;
  classe_id: string;
  classe: string;
  cours_id: string;
  cours: string;
  heure_debut: string;
  heure_fin: string | null;
  salle: string | null;
};

/**
 * Une ligne par (élève × cours prévu terminé) sans scan.
 * Trié par classe, puis horaire, puis nom d'élève — lisible à l'écran
 * comme à l'impression. `cours` doit être le planning du jour (déjà filtré).
 */
export function buildAbsences(
  input: {
    classes: Array<{ id: string; nom: string }>;
    cours: AbsenceCours[];
    eleves: AbsenceEleve[];
  },
  options: { date: string; now?: NowMinutes }
): AbsenceRow[] {
  const classeNom = new Map(input.classes.map((c) => [c.id, c.nom]));
  const rows: AbsenceRow[] = [];

  for (const eleve of input.eleves) {
    const presences = new Set(eleve.presences.map((p) => p.course_id));
    for (const cours of input.cours) {
      if (cours.classe_id !== eleve.classe_id) continue;
      if (!isCourseFinished(options.date, cours.heure_fin, options.now)) continue;
      if (presences.has(cours.id)) continue;
      rows.push({
        eleve_id: eleve.id,
        eleve: eleve.nom,
        classe_id: eleve.classe_id,
        classe: classeNom.get(eleve.classe_id) ?? "",
        cours_id: cours.id,
        cours: cours.nom,
        heure_debut: cours.heure_debut,
        heure_fin: cours.heure_fin ?? null,
        salle: cours.salle ?? null,
      });
    }
  }

  rows.sort(
    (a, b) =>
      a.classe.localeCompare(b.classe, "fr") ||
      a.heure_debut.localeCompare(b.heure_debut) ||
      a.eleve.localeCompare(b.eleve, "fr")
  );
  return rows;
}
