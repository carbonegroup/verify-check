ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS photo_url text;

COMMENT ON COLUMN public.students.photo_url IS
  'Supabase Storage object path for the demo student profile portrait.';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'students',
  'students',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "admin upload student photos" ON storage.objects;
CREATE POLICY "admin upload student photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'students'
  AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

DROP POLICY IF EXISTS "admin update student photos" ON storage.objects;
CREATE POLICY "admin update student photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'students'
  AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
)
WITH CHECK (
  bucket_id = 'students'
  AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

DROP POLICY IF EXISTS "admin delete student photos" ON storage.objects;
CREATE POLICY "admin delete student photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'students'
  AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

DROP POLICY IF EXISTS "admin list student photos" ON storage.objects;
CREATE POLICY "admin list student photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'students'
  AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

UPDATE public.students
SET photo_url = CASE
  WHEN lower(split_part(btrim(nom), ' ', 1)) IN (
    'abdoulaye','aboubacar','alpha','alsény','amadou','amara','boubacar','cheick','famory',
    'fodé','fode','ibrahim','ibrahima','kerfalla','lansana','lassana','laye','mamadi',
    'mamadou','mamady','mohamed','mory','n''faly','nfaly','ousmane','samba','sekou',
    'siaka','sory','tidiane','yaya'
  ) THEN 'students/verifycheck-student-boy.png'
  WHEN lower(split_part(btrim(nom), ' ', 1)) IN (
    'aicha','aïcha','aissatou','aminata','bintou','diane','diané','djenaba','fanta',
    'fatou','fatoumata','haby','hassatou','hawa','kadi','kadiatou','kankou','koumba',
    'm''bali','mbali','m''mah','mmah','maimouna','mariam','mariama','n''mah','nmah',
    'n''nawa','nnawa','nantenin','ramatoulaye','safi','salimatou','saran','yarie'
  ) THEN 'students/verifycheck-student-girl.png'
  ELSE NULL
END
WHERE photo_url IS NULL;
