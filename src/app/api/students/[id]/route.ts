import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_COOKIE, requestAccessToken, requireAdmin, createServerSupabase, setSessionCookies } from "@/lib/auth";
import { isValidEmailAddress } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: NextRequest, context: Context) {
  const accessToken = requestAccessToken(request);
  const auth = await requireAdmin(accessToken, request.cookies.get(REFRESH_COOKIE)?.value);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await context.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "identifiant_invalide" }, { status: 400 });
  let payload: unknown;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: "corps_invalide" }, { status: 400 }); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return NextResponse.json({ error: "corps_invalide" }, { status: 400 });
  const body = payload as Record<string, unknown>;
  const changes: Record<string, unknown> = {};

  if (body.nom !== undefined) {
    if (typeof body.nom !== "string" || !body.nom.trim() || body.nom.trim().length > 100) return NextResponse.json({ error: "nom_invalide" }, { status: 400 });
    changes.nom = body.nom.trim();
  }
  if (body.prenom !== undefined) {
    if (body.prenom !== null && (typeof body.prenom !== "string" || body.prenom.trim().length > 100)) return NextResponse.json({ error: "prenom_invalide" }, { status: 400 });
    changes.prenom = typeof body.prenom === "string" ? body.prenom.trim() || null : null;
  }
  if (body.email !== undefined) {
    if (body.email !== null && body.email !== "" && (typeof body.email !== "string" || !isValidEmailAddress(body.email.trim()))) return NextResponse.json({ error: "email_invalide" }, { status: 400 });
    changes.email = typeof body.email === "string" && body.email.trim() ? body.email.trim().toLowerCase() : null;
  }
  if (body.telephone !== undefined) {
    if (body.telephone !== null && (typeof body.telephone !== "string" || body.telephone.trim().length > 32)) return NextResponse.json({ error: "telephone_invalide" }, { status: 400 });
    changes.telephone = typeof body.telephone === "string" ? body.telephone.trim() || null : null;
  }
  if (body.code_qr !== undefined) {
    if (typeof body.code_qr !== "string" || !body.code_qr.trim() || body.code_qr.trim().length > 64) return NextResponse.json({ error: "matricule_invalide" }, { status: 400 });
    changes.code_qr = body.code_qr.trim();
  }
  if (body.classe_id !== undefined) {
    if (typeof body.classe_id !== "string" || !UUID.test(body.classe_id)) return NextResponse.json({ error: "classe_invalide" }, { status: 400 });
    const supabase = createServerSupabase(auth.session?.access_token ?? accessToken);
    const [{ data: current }, { data: nextClass }] = await Promise.all([
      supabase.from("students").select("is_demo").eq("id", id).maybeSingle(),
      supabase.from("classes").select("is_demo").eq("id", body.classe_id).is("archived_at", null).maybeSingle(),
    ]);
    if (!current || !nextClass || Boolean(current.is_demo) !== Boolean(nextClass.is_demo)) return NextResponse.json({ error: "classe_invalide" }, { status: 400 });
    changes.classe_id = body.classe_id;
  }
  if (body.is_demo !== undefined) {
    return NextResponse.json({ error: "demo_flag_immutable" }, { status: 403 });
  }
  if (body.archived !== undefined) {
    if (typeof body.archived !== "boolean") return NextResponse.json({ error: "statut_invalide" }, { status: 400 });
    changes.archived_at = body.archived ? new Date().toISOString() : null;
  }
  if (Object.keys(changes).length === 0) return NextResponse.json({ error: "aucune_modification" }, { status: 400 });

  const supabase = createServerSupabase(auth.session?.access_token ?? accessToken);
  const { data, error } = await supabase.from("students").update({ ...changes, updated_at: new Date().toISOString() })
    .eq("id", id).select("id,nom,prenom,code_qr,classe_id,email,telephone,photo_url,archived_at,is_demo").single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "matricule_duplique" : "modification_impossible" }, { status: error.code === "23505" ? 409 : 500 });
  const response = NextResponse.json({ student: data });
  if (auth.session) setSessionCookies(response, auth.session);
  return response;
}

export async function DELETE(request: NextRequest, context: Context) {
  const accessToken = requestAccessToken(request);
  const auth = await requireAdmin(accessToken, request.cookies.get(REFRESH_COOKIE)?.value);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await context.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "identifiant_invalide" }, { status: 400 });
  let payload: unknown;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: "confirmation_requise" }, { status: 400 }); }
  if (!payload || typeof payload !== "object" || (payload as { confirmation?: unknown }).confirmation !== "SUPPRIMER DEFINITIVEMENT") {
    return NextResponse.json({ error: "confirmation_requise" }, { status: 400 });
  }
  const supabase = createServerSupabase(auth.session?.access_token ?? accessToken);
  const { error } = await supabase.from("students").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "suppression_impossible" }, { status: 500 });
  const response = NextResponse.json({ ok: true, history_deleted: true });
  if (auth.session) setSessionCookies(response, auth.session);
  return response;
}
