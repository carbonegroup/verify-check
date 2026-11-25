export type CourseTimeSlot = {
  id?: string;
  classe_id: string;
  enseignant?: string | null;
  salle?: string | null;
  heure_debut: string;
  heure_fin: string;
};

export type ExistingCourseSlot = CourseTimeSlot & { id: string };

function minutes(time: string): number {
  const [hour, minute] = time.slice(0, 5).split(":").map(Number);
  return hour * 60 + minute;
}

function normalize(value: string | null | undefined): string {
  return value?.trim().toLocaleLowerCase() ?? "";
}

/**
 * Return a human-readable conflict when two recurring course slots collide.
 * Time slots use half-open intervals [start, end), so adjacent courses are valid.
 * Different classes may run simultaneously unless teacher or room is shared.
 */
export function findScheduleConflict(
  candidate: CourseTimeSlot,
  existing: ExistingCourseSlot[]
): string | null {
  const start = minutes(candidate.heure_debut);
  const end = minutes(candidate.heure_fin);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    return "créneau_horaire_invalide";
  }

  for (const other of existing) {
    if (candidate.id && other.id === candidate.id) continue;
    const overlap = start < minutes(other.heure_fin) && end > minutes(other.heure_debut);
    if (!overlap) continue;

    if (candidate.classe_id === other.classe_id) {
      return `Conflit de créneau avec ${other.id} (même classe).`;
    }
    const teacher = normalize(candidate.enseignant);
    if (teacher && teacher === normalize(other.enseignant)) {
      return `Conflit enseignant avec ${other.id}.`;
    }
    const room = normalize(candidate.salle);
    if (room && room === normalize(other.salle)) {
      return `Conflit de salle avec ${other.id}.`;
    }
  }
  return null;
}
