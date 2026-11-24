-- Migration: Add photo_url column to students table
-- Description: Add a nullable photo_url column to store Supabase Storage paths for student profile photos.
-- This is a backward-compatible change - existing students without photos will have NULL values.

ALTER TABLE students
ADD COLUMN IF NOT EXISTS photo_url text;

-- Add a comment explaining the field
COMMENT ON COLUMN students.photo_url IS 'Supabase Storage path to student profile photo (e.g., public/students/uuid.png). Nullable.';