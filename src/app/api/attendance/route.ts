import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_COOKIE, requestAccessToken, requireAdmin, createServerSupabase, setSessionCookies } from "@/lib/auth";
import { dayWindow, isIsoDate } from "@/lib/dashboard";
import { schoolInstant } from "@/lib/time";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const STATUSES = new Set(["present", "absent", "retard"]);

export async function GET(request: NextRequest) {
  const accessToken = requestAccessToken(request);
  const auth = await requireAdmin(accessToken, request.cookies.get(REFRESH_COOKIE)?.value);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const params = request.nextUrl.searchParams;
  const date = params.get("date") ?? schoolInstant().jour;
  if (!isIsoDate(date)) return NextResponse.json({ error: "date_invalide" }, { status: 400 });
  const page = Math.max(1, Number(params.get("page") ?? 1));
  const perPage = Math.max(1, Math.min(100, Number(params.get("perPage") ?? 50)));
  const { startAt, endAt } = dayWindow(date);
  const supabase = createServerSupabase(auth.session?.access_token ?? accessToken);
  let query = supabase.from("attendance").select(
    "id,student_id,course_id,scanned_at,statut,source,motif,updated_by,students!inner(id,nom,prenom,code_qr,classe_id),courses!inner(id,nom,classe_id,salle)",
    { count: "exact" }
  ).gte("scanned_at", startAt).lt("scanned_at", endAt).order("scanned_at", { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);
  if (params.get("classe")) query = query.eq("students.classe_id", params.get("classe")!);
  if (params.get("cours")) query = query.eq("course_id", params.get("cours")!);
  if (params.get("statut") && STATUSES.has(params.get("statut")!)) query = query.eq("statut", params.get("statut")!);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: "erreur_base" }, { status: 500 });
  const response = NextResponse.json({ attendances: data ?? [], date, page, perPage, total: count ?? 0 });
  if (auth.session) setSessionCookies(response, auth.session);
  return response;
}

export async function POST(request: NextRequest) {
  const accessToken = requestAccessToken(request);
  const auth = await requireAdmin(accessToken, request.cookies.get(REFRESH_COOKIE)?.value);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  let payload: unknown;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: "corps_invalide" }, { status: 400 }); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return NextResponse.json({ error: "corps_invalide" }, { status: 400 });
  const body = payload as Record<string, unknown>;
  const studentId = typeof body.student_id === "string" ? body.student_id : "";
  const courseId = typeof body.course_id === "string" ? body.course_id : "";
  const date = typeof body.date === "string" ? body.date : "";
  const time = typeof body.heure === "string" ? body.heure : "";
  const status = typeof body.statut === "string" ? body.statut : "";
  const reason = typeof body.motif === "string" ? body.motif.trim() : "";
  if (!UUID.test(studentId) || !UUID.test(courseId) || !isIsoDate(date) || !TIME.test(time) ||
      !STATUSES.has(status) || reason.length < 3 || reason.length > 500) {
    return NextResponse.json({ error: "champs_invalides" }, { status: 400 });
  }

  const supabase = createServerSupabase(auth.session?.access_token ?? accessToken);
  const [{ data: student, error: studentError }, { data: course, error: courseError }] = await Promise.all([
    supabase.from("students").select("id,classe_id,is_demo").eq("id", studentId).is("archived_at", null).maybeSingle(),
    supabase.from("courses").select("id,classe_id,is_demo").eq("id", courseId).is("archived_at", null).maybeSingle(),
  ]);
  if (studentError || courseError) return NextResponse.json({ error: "erreur_base" }, { status: 500 });
  if (!student || !course || student.classe_id !== course.classe_id || Boolean(student.is_demo) !== Boolean(course.is_demo)) {
    return NextResponse.json({ error: "contexte_academique_invalide" }, { status: 400 });
  }

  // Conakry is UTC+0; this timestamp preserves the selected school date and time.
  const scannedAt = new Date(`${date}T${time}:00.000Z`).toISOString();
  const { data, error } = await supabase.from("attendance").insert({
    student_id: studentId,
    course_id: courseId,
    scanned_at: scannedAt,
    statut: status,
    source: "manual",
    motif: reason,
    updated_by: auth.user.id,
  }).select("id,student_id,course_id,scanned_at,statut,source,motif").single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "presence_deja_enregistree" : "enregistrement_impossible" }, { status: error.code === "23505" ? 409 : 500 });

  const response = NextResponse.json({ attendance: data }, { status: 201 });
  if (auth.session) setSessionCookies(response, auth.session);
  return response;
}
