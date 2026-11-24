-- Migration: Create Supabase Storage bucket for student photos and assign demo photos
-- Description: Creates a 'students' bucket with proper RLS policies, uploads demo photos,
-- and assigns them to students based on gender inference from names.

-- =============================================================================
-- 1. CREATE STORAGE BUCKET
-- =============================================================================

-- Note: Storage bucket creation requires Supabase Dashboard or CLI
-- This is a reference for manual setup:
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES ('students', 'students', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp']);

-- =============================================================================
-- 2. STORAGE RLS POLICIES
-- =============================================================================

-- Allow authenticated admins to upload photos
-- (Run these in Supabase Dashboard > Storage > Policies)

-- Policy: Admins can upload student photos
-- CREATE POLICY "admin upload student photos"
-- ON storage.objects FOR INSERT TO authenticated
-- WITH CHECK (
--   bucket_id = 'students'
--   AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
-- );

-- Policy: Admins can update student photos
-- CREATE POLICY "admin update student photos"
-- ON storage.objects FOR UPDATE TO authenticated
-- USING (
--   bucket_id = 'students'
--   AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
-- )
-- WITH CHECK (
--   bucket_id = 'students'
--   AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
-- );

-- Policy: Admins can delete student photos
-- CREATE POLICY "admin delete student photos"
-- ON storage.objects FOR DELETE TO authenticated
-- USING (
--   bucket_id = 'students'
--   AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
-- );

-- Policy: Anyone (admin session) can read student photos
-- CREATE POLICY "authenticated read student photos"
-- ON storage.objects FOR SELECT TO authenticated
-- USING (bucket_id = 'students');

-- =============================================================================
-- 3. ASSIGN DEMO PHOTOS TO STUDENTS
-- =============================================================================

-- This section assigns the uploaded photos to students.
-- Run AFTER uploading the two images to the 'students' bucket:
-- - verifycheck-student-boy.png → path: students/verifycheck-student-boy.png
-- - verifycheck-student-girl.png → path: students/verifycheck-student-girl.png

-- Male associated names (common Guinean male first names in the seed)
-- Update male students
UPDATE students
SET photo_url = 'students/verifycheck-student-boy.png'
WHERE photo_url IS NULL
  AND (
    -- Common male first names in the seed data
    nom LIKE 'Mamadou %' OR nom LIKE 'Ibrahima %' OR nom LIKE 'Ousmane %' OR nom LIKE 'Sekou %'
    OR nom LIKE 'Alpha %' OR nom LIKE 'Mohamed %' OR nom LIKE 'Abdoulaye %' OR nom LIKE 'Amadou %'
    OR nom LIKE 'Cheick %' OR nom LIKE 'Lansana %' OR nom LIKE 'Sory %' OR nom LIKE 'Boubacar %'
    OR nom LIKE 'Mory %' OR nom LIKE 'Fodé %' OR nom LIKE 'Tidiane %' OR nom LIKE 'Alsény %'
    OR nom LIKE 'Aboubacar %' OR nom LIKE 'Kerfalla %' OR nom LIKE 'Yaya %' OR nom LIKE 'Mamadi %'
    OR nom LIKE 'Laye %' OR nom LIKE 'Amara %' OR nom LIKE 'N''Faly %' OR nom LIKE 'Samba %'
    OR nom LIKE 'Mamady %' OR nom LIKE 'Famory %' OR nom LIKE 'Siaka %'
    OR nom LIKE '% Mamadou' OR nom LIKE '% Ibrahima' OR nom LIKE '% Ousmane'
  );

-- Female associated names (common Guinean female first names in the seed)
-- Update female students
UPDATE students
SET photo_url = 'students/verifycheck-student-girl.png'
WHERE photo_url IS NULL
  AND (
    -- Common female first names in the seed data
    nom LIKE 'Aïcha %' OR nom LIKE 'Fatoumata %' OR nom LIKE 'Mariama %' OR nom LIKE 'Aminata %'
    OR nom LIKE 'Hawa %' OR nom LIKE 'Kadiatou %' OR nom LIKE 'Bintou %' OR nom LIKE 'Ramatoulaye %'
    OR nom LIKE 'Salimatou %' OR nom LIKE 'Fanta %' OR nom LIKE 'M''Mah %' OR nom LIKE 'Kadi %'
    OR nom LIKE 'Aissatou %' OR nom LIKE 'N''Mah %' OR nom LIKE 'Haby %' OR nom LIKE 'Djenaba %'
    OR nom LIKE 'Koumba %' OR nom LIKE 'Maimouna %' OR nom LIKE 'Nantenin %' OR nom LIKE 'Saran %'
    OR nom LIKE 'Diané %' OR nom LIKE 'Safi %' OR nom LIKE 'Yarie %' OR nom LIKE 'M''Bali %'
    OR nom LIKE 'Hassatou %' OR nom LIKE 'N''Nawa %' OR nom LIKE 'Kankou %'
    OR nom LIKE '% Aïcha' OR nom LIKE '% Fatoumata' OR nom LIKE '% Mariama'
    OR nom LIKE '% Aminata' OR nom LIKE '% Hawa' OR nom LIKE '% Kadiatou'
  );

-- Remaining students without clear gender association get boy photo as default
-- (This ensures all students have a photo)
UPDATE students
SET photo_url = 'students/verifycheck-student-boy.png'
WHERE photo_url IS NULL;

-- =============================================================================
-- 4. VERIFICATION QUERIES
-- =============================================================================

-- Check assignment statistics
-- SELECT
--   photo_url,
--   COUNT(*) as count
-- FROM students
-- GROUP BY photo_url
-- ORDER BY count DESC;

-- Check students without photos (should be 0 after migration)
-- SELECT COUNT(*) as without_photo FROM students WHERE photo_url IS NULL;