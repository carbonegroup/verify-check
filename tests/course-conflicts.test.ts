import { test } from "node:test";
import assert from "node:assert/strict";
import { findScheduleConflict, type CourseTimeSlot, type ExistingCourseSlot } from "../src/lib/course-conflicts.ts";

const existing: ExistingCourseSlot[] = [
  { id: "same-class", classe_id: "class-a", enseignant: "A. Barry", salle: "B12", heure_debut: "08:00", heure_fin: "09:00" },
  { id: "teacher", classe_id: "class-b", enseignant: "Fatou Camara", salle: "C02", heure_debut: "09:00", heure_fin: "10:30" },
  { id: "room", classe_id: "class-c", enseignant: "Ibrahima Diallo", salle: "D05", heure_debut: "11:00", heure_fin: "12:00" },
];

function candidate(overrides: Partial<CourseTimeSlot> = {}): CourseTimeSlot {
  return {
    classe_id: "class-new",
    enseignant: "M. Keita",
    salle: "E01",
    heure_debut: "08:15",
    heure_fin: "08:45",
    ...overrides,
  };
}

test("rejects overlapping slots for the same class", () => {
  assert.equal(
    findScheduleConflict(candidate({ classe_id: "class-a" }), existing),
    "Conflit de créneau avec same-class (même classe)."
  );
});

test("rejects overlapping slots for the same teacher in different classes", () => {
  assert.equal(
    findScheduleConflict(candidate({ enseignant: "  FATOU CAMARA ", heure_debut: "09:15", heure_fin: "09:45" }), existing),
    "Conflit enseignant avec teacher."
  );
});

test("rejects overlapping slots for the same room in different classes", () => {
  assert.equal(
    findScheduleConflict(candidate({ salle: " d05 ", heure_debut: "11:15", heure_fin: "11:45" }), existing),
    "Conflit de salle avec room."
  );
});

test("allows different classes, teachers and rooms to run at the same time", () => {
  assert.equal(findScheduleConflict(candidate(), existing), null);
});

test("allows adjacent half-open course slots", () => {
  const adjacent = [{ ...existing[0], heure_debut: "09:00", heure_fin: "10:00" }];
  assert.equal(
    findScheduleConflict(candidate({ classe_id: "class-a", heure_debut: "08:00", heure_fin: "09:00" }), adjacent),
    null
  );
});

test("ignores the current course while editing it", () => {
  const current = { ...existing[0], heure_debut: "08:00", heure_fin: "09:00" };
  assert.equal(
    findScheduleConflict({ ...current, id: current.id }, [current]),
    null
  );
});

test("rejects invalid time intervals", () => {
  assert.equal(
    findScheduleConflict(candidate({ heure_debut: "10:00", heure_fin: "09:00" }), []),
    "créneau_horaire_invalide"
  );
});
