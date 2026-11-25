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
 * GET /api/dashboard — real academic data, with demo fixtures excluded by default.
 * DEV may opt into the isolated test dataset via ?demo=1.
 */
export async function GET(request: NextRequest) {
  const accessToken = requestAccessToken(request);
  const auth = await requireAdmin(accessToken, request.cookies.get(REFRESH_COOKIE)?.value);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const params = request.nextUrl.searchParams;
  const date = params.get("date") ?? schoolInstant().jour;
  if (!isIsoDate(date)) return NextResponse.json({ error: "date_invalide" }, { status: 400 });

  const includeDemo = auth.user.role === "dev" && params.get("demo") === "1";
  const supabase = createServerSupabase(auth.session?.access_token ?? accessToken);
  const { startAt, endAt } = dayWindow(date);

  let classesQuery = supabase.from("classes").select("id, nom").is("archived_at", null).order("nom");
  let coursesQuery = supabase.from("courses")
    .select("id, nom, classe_id, salle, jour_semaine, heure_debut, heure_fin, enseignant")
    .is("archived_at", null).order("heure_debut");
  let studentsQuery = supabase.from("students")
    .select("id, nom, prenom, code_qr, classe_id, photo_url")
    .is("archived_at", null).order("nom");
  if (!includeDemo) {
    classesQuery = classesQuery.eq("is_demo", false);
    coursesQuery = coursesQuery.eq("is_demo", false);
    studentsQuery = studentsQuery.eq("is_demo", false);
  }

  const [classesRes, coursesRes, studentsWithPhotoRes, attendanceRes] = await Promise.all([
    classesQuery,
    coursesQuery,
    studentsQuery,
    supabase.from("attendance")
      .select("id, student_id, course_id, scanned_at, statut, source, motif")
      .gte("scanned_at", startAt).lt("scanned_at", endAt),
  ]);

  const studentsRes =
    studentsWithPhotoRes.error && isMissingStudentPhotoUrlColumn(studentsWithPhotoRes.error)
      ? await (includeDemo
          ? supabase.from("students").select("id, nom, code_qr, classe_id").is("archived_at", null).order("nom")
          : supabase.from("students").select("id, nom, code_qr, classe_id").is("archived_at", null).eq("is_demo", false).order("nom"))
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

  const response = NextResponse.json({ ...result, demo_mode: includeDemo, role: auth.user.role });
  if (auth.session) setSessionCookies(response, auth.session);
  return response;
}
