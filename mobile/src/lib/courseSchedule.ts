export type ScheduledCourse = {
  id: string;
  nom: string;
  classe_id: string;
  salle: string | null;
  heure_debut: string;
  heure_fin: string;
  actif: boolean;
};

export type CourseScheduleStatus = "active" | "upcoming" | "finished";

/** Keep every course for the selected class; activity only controls its label. */
export function getCoursesForClass<T extends { classe_id: string }>(
  courses: T[],
  classeId: string | null
): T[] {
  if (!classeId) return [];
  return courses.filter((course) => course.classe_id === classeId);
}

/** Compare local HH:mm values supplied by the Conakry context endpoint. */
export function getCourseScheduleStatus(
  course: Pick<ScheduledCourse, "actif" | "heure_debut" | "heure_fin">,
  currentTime: string
): CourseScheduleStatus {
  if (course.actif) return "active";
  return currentTime.slice(0, 5) < course.heure_debut.slice(0, 5)
    ? "upcoming"
    : "finished";
}
