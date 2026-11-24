/**
 * Resolve a stored student portrait reference.
 * Root-relative paths point to versioned public assets; other paths are
 * Supabase Storage object paths in the form "bucket/path/to/file".
 */
export function studentPhotoSrc(
  photoUrl: string | null | undefined,
  supabaseUrl: string | null | undefined
): string | null {
  if (!photoUrl) return null;
  if (photoUrl.startsWith("/") || /^https?:\/\//i.test(photoUrl)) return photoUrl;
  if (!supabaseUrl) return null;

  const base = supabaseUrl.replace(/\/+$/, "");
  const path = photoUrl.replace(/^\/+/, "");
  return `${base}/storage/v1/object/public/${path}`;
}
