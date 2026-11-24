import { test } from "node:test";
import assert from "node:assert/strict";
import { isMissingStudentPhotoUrlColumn } from "../src/lib/student-photo-compat.ts";

test("reconnaît une colonne photo_url absente côté PostgreSQL", () => {
  assert.equal(
    isMissingStudentPhotoUrlColumn({
      code: "42703",
      message: 'column students.photo_url does not exist',
    }),
    true
  );
});

test("reconnaît une colonne photo_url absente du cache PostgREST", () => {
  assert.equal(
    isMissingStudentPhotoUrlColumn({
      code: "PGRST204",
      message: "Could not find the 'photo_url' column of 'students' in the schema cache",
    }),
    true
  );
});

test("ne masque pas les autres erreurs Supabase", () => {
  assert.equal(
    isMissingStudentPhotoUrlColumn({
      code: "42703",
      message: "column students.avatar_url does not exist",
    }),
    false
  );
  assert.equal(
    isMissingStudentPhotoUrlColumn({
      code: "42501",
      message: "permission denied for table students",
    }),
    false
  );
  assert.equal(isMissingStudentPhotoUrlColumn(null), false);
});
