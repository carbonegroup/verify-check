import { test } from "node:test";
import assert from "node:assert/strict";
import { studentPhotoSrc } from "../src/lib/student-photo-url.ts";

test("studentPhotoSrc uses root-relative public assets unchanged", () => {
  assert.equal(
    studentPhotoSrc("/students/verifycheck-student-boy.png", "https://example.supabase.co"),
    "/students/verifycheck-student-boy.png"
  );
});

test("studentPhotoSrc preserves absolute URLs", () => {
  assert.equal(
    studentPhotoSrc("https://cdn.example.com/student.png", "https://example.supabase.co"),
    "https://cdn.example.com/student.png"
  );
});

test("studentPhotoSrc builds a public Supabase Storage URL", () => {
  assert.equal(
    studentPhotoSrc("students/student.png", "https://example.supabase.co/"),
    "https://example.supabase.co/storage/v1/object/public/students/student.png"
  );
});

test("studentPhotoSrc returns null when no usable reference is available", () => {
  assert.equal(studentPhotoSrc(null, "https://example.supabase.co"), null);
  assert.equal(studentPhotoSrc("students/student.png", null), null);
});
