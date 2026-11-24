UPDATE public.students
SET photo_url = CASE
  WHEN photo_url = 'students/verifycheck-student-boy.png' THEN '/students/verifycheck-student-boy.png'
  WHEN photo_url = 'students/verifycheck-student-girl.png' THEN '/students/verifycheck-student-girl.png'
  ELSE photo_url
END
WHERE photo_url IN (
  'students/verifycheck-student-boy.png',
  'students/verifycheck-student-girl.png'
);

COMMENT ON COLUMN public.students.photo_url IS
  'Root-relative public asset path or Supabase Storage object path for the student portrait.';
