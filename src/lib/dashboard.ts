/**
 * Calculs purs du dashboard (Sprint 3) — testables sans réseau ni base.
 * Toutes les dates sont des journées scolaires Africa/Conakry (GMT+0, pas
 * d'heure d'été : les bornes UTC de la journée locale sont donc directes).
 */

import { SCHOOL_TIME_ZONE } from "./time.ts";

/**
 * Vrai uniquement pour une date calendaire réelle `YYYY-MM-DD`.
 * Le format seul ne suffit pas : `2026-13-45` ou `2026-02-31` passeraient le
 * regex mais produiraient une `Date` invalide (`Invalid time value` plus loin).
 */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function nextDayIso(date: string): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Jour de semaine (0 = dimanche) de la date scolaire demandée. */
export function weekdayOfIso(date: string): number {
  return new Date(`${date}T12:00:00.000Z`).getUTCDay();
}

/** Fenêtre [début, fin) de la journée scolaire, en horodatages UTC. */
export function dayWindow(date: string): { startAt: string; endAt: string } {
  return {
    startAt: `${date}T00:00:00+00:00`,
    endAt: `${nextDayIso(date)}T00:00:00+00:00`,
  };
}

export type ClassRow = { id: string; nom: string };
export type CourseRow = {
  id: string;
  nom: string;
  classe_id: string;
  salle: string | null;
  jour_semaine: number;
  heure_debut: string;
  heure_fin: string;
};
export type StudentRow = {
  id: string;
  nom: string;
  code_qr: string;
  classe_id: string;
  photo_url?: string | null;
};
export type AttendanceRow = {
  id: string;
  student_id: string;
  course_id: string;
  scanned_at: string;
  statut?: "present" | "absent" | "retard";
  source?: "scan" | "manual";
};

export type DashboardFilters = {
  date: string;
  classe?: string;
  cours?: string;
  eleve?: string;
};

export type DashboardResult = {
  date: string;
  fuseau: string;
  jour_semaine: number;
  classes: ClassRow[];
  cours_prevus: CourseRow[];
  /** Tous les cours de la semaine pour afficher le planning complet. */
  cours_semaine: CourseRow[];
  /** Tous les cours de la classe sélectionnée, tous jours confondus. */
  cours_disponibles: CourseRow[];
  effectif: number;
  presents: number;
  scans: number;
  eleves: Array<{
    id: string;
    nom: string;
    code_qr: string;
    classe_id: string;
    photo_url?: string | null;
    scans: number;
    presences: Array<{ course_id: string; scanned_at: string }>;
  }>;
};

/** Agrège les données brutes en planning + résumé + présence par élève. */
export function buildDashboard(
  raw: {
    classes: ClassRow[];
    courses: CourseRow[];
    students: StudentRow[];
    attendance: AttendanceRow[];
  },
  filters: DashboardFilters
): DashboardResult {
  const weekday = weekdayOfIso(filters.date);

  const weeklyCourses = raw.courses
    .filter((c) => !filters.classe || c.classe_id === filters.classe)
    .sort((a, b) => a.jour_semaine - b.jour_semaine || a.heure_debut.localeCompare(b.heure_debut));
  const filteredWeeklyCourses = weeklyCourses.filter((c) => !filters.cours || c.id === filters.cours);
  const availableCourses = weeklyCourses.filter((c) => c.jour_semaine === weekday);
  const plannedCourses = availableCourses.filter(
    (c) => !filters.cours || c.id === filters.cours
  );

  const visibleStudents = raw.students
    .filter((s) => !filters.classe || s.classe_id === filters.classe)
    .filter((s) => !filters.eleve || s.id === filters.eleve);

  const plannedCourseIds = new Set(plannedCourses.map((c) => c.id));
  const visibleStudentIds = new Set(visibleStudents.map((s) => s.id));
  const rows = raw.attendance.filter(
    (a) => plannedCourseIds.has(a.course_id) && visibleStudentIds.has(a.student_id)
  );
  const presenceRows = rows.filter((row) => row.statut !== "absent");
  const scanRows = rows.filter((row) => row.source === undefined || row.source === "scan");

  const presencesByStudent = new Map<string, AttendanceRow[]>();
  for (const row of presenceRows) {
    const list = presencesByStudent.get(row.student_id) ?? [];
    list.push(row);
    presencesByStudent.set(row.student_id, list);
  }

  const presentCount = visibleStudents.filter(
    (s) => (presencesByStudent.get(s.id)?.length ?? 0) > 0
  ).length;

  return {
    date: filters.date,
    fuseau: SCHOOL_TIME_ZONE,
    jour_semaine: weekday,
    classes: raw.classes,
    cours_prevus: plannedCourses,
    cours_semaine: filteredWeeklyCourses,
    cours_disponibles: weeklyCourses,
    effectif: visibleStudents.length,
    presents: presentCount,
    scans: scanRows.length,
    eleves: visibleStudents.map((s) => ({
      id: s.id,
      nom: s.nom,
      code_qr: s.code_qr,
      classe_id: s.classe_id,
      photo_url: s.photo_url,
      scans: scanRows.filter((row) => row.student_id === s.id).length,
      presences: (presencesByStudent.get(s.id) ?? []).map((row) => ({
        course_id: row.course_id,
        scanned_at: row.scanned_at,
      })),
    })),
  };
}
