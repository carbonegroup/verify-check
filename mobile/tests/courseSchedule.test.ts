import { test } from "node:test";
import assert from "node:assert/strict";
import { getCourseScheduleStatus, getCoursesForClass } from "../src/lib/courseSchedule.ts";

const courses = [
  { id: "a", classe_id: "class-1", actif: false, heure_debut: "13:30:00", heure_fin: "15:00:00" },
  { id: "b", classe_id: "class-1", actif: true, heure_debut: "08:00:00", heure_fin: "09:00:00" },
  { id: "c", classe_id: "class-2", actif: false, heure_debut: "11:00:00", heure_fin: "12:00:00" },
];

test("picker keeps upcoming and finished courses for the selected class", () => {
  assert.deepEqual(getCoursesForClass(courses, "class-1").map((course) => course.id), ["a", "b"]);
  assert.deepEqual(getCoursesForClass(courses, null), []);
});

test("schedule status distinguishes active, upcoming and finished courses", () => {
  assert.equal(getCourseScheduleStatus(courses[0], "11:00"), "upcoming");
  assert.equal(getCourseScheduleStatus(courses[0], "13:45"), "upcoming");
  assert.equal(getCourseScheduleStatus({ ...courses[0], actif: true }, "13:45"), "active");
  assert.equal(getCourseScheduleStatus(courses[0], "15:00"), "finished");
});
