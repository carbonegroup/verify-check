export type CourseTimeSlot = {
  id?: string;
  classe_id: string;
  enseignant?: string | null;
  salle?: string | null;
  heure_debut: string;
  heure_fin: string;
};

export type ExistingCourseSlot = CourseTimeSlot & { id: string };
export type ScheduleConflictDetail = {
  other: ExistingCourseSlot;
  kind: "class" | "teacher" | "room";
  message: string;
};

function minutes(time: string): number {
  const [hour, minute] = time.slice(0, 5).split(":").map(Number);
  return hour * 60 + minute;
}

function normalize(value: string | null | undefined): string {
  return value?.trim().toLocaleLowerCase() ?? "";
}

/**
 * Return a structured conflict for two recurring course slots.
 * Time slots use half-open intervals [start, end), so adjacent courses are valid.
 */
export function findScheduleConflictDetail(
  candidate: CourseTimeSlot,
  existing: ExistingCourseSlot[]
): ScheduleConflictDetail | null {
  const start = minutes(candidate.heure_debut);
  const end = minutes(candidate.heure_fin);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    return {
      other: { id: "", classe_id: "", heure_debut: candidate.heure_debut, heure_fin: candidate.heure_fin },
      kind: "class",
      message: "créneau_horaire_invalide",
    };
  }

  for (const other of existing) {
    if (candidate.id && other.id === candidate.id) continue;
    const overlap = start < minutes(other.heure_fin) && end > minutes(other.heure_debut);
    if (!overlap) continue;

    if (candidate.classe_id === other.classe_id) {
      return { other, kind: "class", message: `Conflit de créneau avec ${other.id} (même classe).` };
    }
    const teacher = normalize(candidate.enseignant);
    if (teacher && teacher === normalize(other.enseignant)) {
      return { other, kind: "teacher", message: `Conflit enseignant avec ${other.id}.` };
    }
    const room = normalize(candidate.salle);
    if (room && room === normalize(other.salle)) {
      return { other, kind: "room", message: `Conflit de salle avec ${other.id}.` };
    }
  }
  return null;
}

/** Backward-compatible human-readable conflict helper for API handlers. */
export function findScheduleConflict(
  candidate: CourseTimeSlot,
  existing: ExistingCourseSlot[]
): string | null {
  return findScheduleConflictDetail(candidate, existing)?.message ?? null;
}
