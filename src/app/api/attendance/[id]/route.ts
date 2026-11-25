import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_COOKIE, requestAccessToken, requireAdmin, createServerSupabase, setSessionCookies } from "@/lib/auth";

type Context = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES = new Set(["present", "absent", "retard"]);

export async function PATCH(request: NextRequest, context: Context) {
  const accessToken = requestAccessToken(request);
  const auth = await requireAdmin(accessToken, request.cookies.get(REFRESH_COOKIE)?.value);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await context.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "identifiant_invalide" }, { status: 400 });
  let payload: unknown;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: "corps_invalide" }, { status: 400 }); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return NextResponse.json({ error: "corps_invalide" }, { status: 400 });
  const body = payload as { statut?: unknown; motif?: unknown };
  if (typeof body.statut !== "string" || !STATUSES.has(body.statut) ||
      typeof body.motif !== "string" || body.motif.trim().length < 3 || body.motif.trim().length > 500) {
    return NextResponse.json({ error: "statut_et_justification_requis" }, { status: 400 });
  }

  const supabase = createServerSupabase(auth.session?.access_token ?? accessToken);
  const { data, error } = await supabase.from("attendance").update({
    statut: body.statut,
    motif: body.motif.trim(),
    updated_by: auth.user.id,
    updated_at: new Date().toISOString(),
  }).eq("id", id).select("id,student_id,course_id,scanned_at,statut,source,motif,updated_by").single();
  if (error) return NextResponse.json({ error: "correction_impossible" }, { status: 500 });
  const response = NextResponse.json({ attendance: data });
  if (auth.session) setSessionCookies(response, auth.session);
  return response;
}
