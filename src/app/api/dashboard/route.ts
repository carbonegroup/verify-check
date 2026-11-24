import { NextResponse, type NextRequest } from "next/server";
import {
  REFRESH_COOKIE,
  requestAccessToken,
  createServerSupabase,
  requireAdmin,
  setSessionCookies,
} from "@/lib/auth";
import { buildDashboard, dayWindow, isIsoDate } from "@/lib/dashboard";
import { isMissingStudentPhotoUrlColumn } from "@/lib/student-photo-compat";
import { schoolInstant } from "@/lib/time";

/**
 * GET /api/dashboard — Sprint 3 : requêtes du dashboard direction.
 * Params : date (YYYY-MM-DD, défaut = aujourd'hui Conakry), classe?, cours?, eleve?
 * Réponse : planning du jour (cours de la classe prévus ce jour de semaine local),
 * effectif, présences de la journée, résumé par cours.
 * L'accès est protégé par la session admin ; RLS filtre les lignes côté base.
 * Si la session a dû être renouvelée (access token expiré), les cookies sont ré-écrits.
 */

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(
    requestAccessToken(request),
    request.cookies.get(REFRESH_COOKIE)?.value
  );
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const params = request.nextUrl.searchParams;
  const date = params.get("date") ?? schoolInstant().jour;
  if (!isIsoDate(date)) {
    return NextResponse.json({ error: "date_invalide" }, { status: 400 });
  }

  const supabase = createServerSupabase(
    auth.session?.access_token ?? requestAccessToken(request)
  );
  const { startAt, endAt } = dayWindow(date);

  const [classesRes, coursesRes, studentsWithPhotoRes, attendanceRes] = await Promise.all([
    supabase.from("classes").select("id, nom").order("nom"),
    supabase
      .from("courses")
      .select("id, nom, classe_id, salle, jour_semaine, heure_debut, heure_fin")
      .order("heure_debut"),
    supabase.from("students").select("id, nom, code_qr, classe_id, photo_url").order("nom"),
    supabase
      .from("attendance")
      .select("id, student_id, course_id, scanned_at")
      .gte("scanned_at", startAt)
      .lt("scanned_at", endAt),
  ]);

  // A photo migration can be pending in Supabase production. Keep the dashboard
  // operational with the legacy student fields until photo_url exists.
  const studentsRes =
    studentsWithPhotoRes.error && isMissingStudentPhotoUrlColumn(studentsWithPhotoRes.error)
      ? await supabase.from("students").select("id, nom, code_qr, classe_id").order("nom")
      : studentsWithPhotoRes;

  if (classesRes.error || coursesRes.error || studentsRes.error || attendanceRes.error) {
    return NextResponse.json({ error: "erreur_base" }, { status: 500 });
  }

  const result = buildDashboard(
    {
      classes: (classesRes.data ?? []) as never,
      courses: (coursesRes.data ?? []) as never,
      students: (studentsRes.data ?? []) as never,
      attendance: (attendanceRes.data ?? []) as never,
    },
    {
      date,
      classe: params.get("classe") ?? undefined,
      cours: params.get("cours") ?? undefined,
      eleve: params.get("eleve") ?? undefined,
    }
  );
  // Le jour de semaine du planning est calculé dans buildDashboard (weekdayOfIso).

  const response = NextResponse.json(result);
  if (auth.session) setSessionCookies(response, auth.session);
  return response;
}
