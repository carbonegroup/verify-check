/**
 * Compatibility guard for the optional student profile-photo column.
 *
 * The photo_url migration is deployed separately from the web application.
 * Until it reaches production, the API can still serve the legacy student
 * fields without turning a missing optional column into a dashboard outage.
 */
export type SupabaseColumnError = {
  code?: string | null;
  message?: string | null;
};

export function isMissingStudentPhotoUrlColumn(
  error: SupabaseColumnError | null | undefined
): boolean {
  if (!error || (error.code !== "42703" && error.code !== "PGRST204")) {
    return false;
  }

  return /\bphoto_url\b/i.test(error.message ?? "");
}
