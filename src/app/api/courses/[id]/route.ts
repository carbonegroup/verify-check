import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_COOKIE, requestAccessToken, requireAdmin, createServerSupabase, setSessionCookies } from "@/lib/auth";
import { findScheduleConflict } from "@/lib/course-conflicts";

type Context = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

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
  const supabase = createServerSupabase(auth.session?.access_token ?? accessToken);
  const { data: current, error: currentError } = await supabase.from("courses")
    .select("id,classe_id,nom,salle,enseignant,jour_semaine,heure_debut,heure_fin,is_demo")
    .eq("id", id).maybeSingle();
  if (currentError || !current) return NextResponse.json({ error: "cours_introuvable" }, { status: 404 });

  const changes: Record<string, unknown> = {};
  const nom = body.nom === undefined ? current.nom : typeof body.nom === "string" ? body.nom.trim() : "";
  const classeId = body.classe_id === undefined ? current.classe_id : typeof body.classe_id === "string" ? body.classe_id : "";
  const day = body.jour_semaine === undefined ? current.jour_semaine : Number(body.jour_semaine);
  const start = body.heure_debut === undefined ? String(current.heure_debut).slice(0, 5) : typeof body.heure_debut === "string" ? body.heure_debut : "";
  const end = body.heure_fin === undefined ? String(current.heure_fin).slice(0, 5) : typeof body.heure_fin === "string" ? body.heure_fin : "";
  const salle = body.salle === undefined ? current.salle : typeof body.salle === "string" ? body.salle.trim() || null : null;
  const enseignant = body.enseignant === undefined ? current.enseignant : typeof body.enseignant === "string" ? body.enseignant.trim() || null : null;

  if (!nom || nom.length > 120 || !UUID.test(classeId) || !Number.isInteger(day) || day < 0 || day > 6 ||
      !TIME.test(start) || !TIME.test(end) || toMinutes(start) >= toMinutes(end) ||
      (salle && salle.length > 64) || (enseignant && enseignant.length > 120)) {
    return NextResponse.json({ error: "champs_invalides" }, { status: 400 });
  }
  if (body.archived !== undefined) {
    if (typeof body.archived !== "boolean") return NextResponse.json({ error: "statut_invalide" }, { status: 400 });
    changes.archived_at = body.archived ? new Date().toISOString() : null;
  }
  const { data: classroom } = await supabase.from("classes").select("is_demo").eq("id", classeId).is("archived_at", null).maybeSingle();
  if (!classroom || Boolean(classroom.is_demo) !== Boolean(current.is_demo)) return NextResponse.json({ error: "classe_invalide" }, { status: 400 });

  if (body.archived !== true) {
    const { data: conflicts, error: conflictError } = await supabase.from("courses")
      .select("id,classe_id,enseignant,salle,heure_debut,heure_fin")
      .eq("jour_semaine", day).eq("is_demo", current.is_demo).is("archived_at", null);
    if (conflictError) return NextResponse.json({ error: "verification_conflits_indisponible" }, { status: 500 });
    const conflict = findScheduleConflict({
      id, classe_id: classeId, enseignant, salle, heure_debut: start, heure_fin: end,
    }, (conflicts ?? []) as Array<{
      id: string; classe_id: string; enseignant: string | null; salle: string | null;
      heure_debut: string; heure_fin: string;
    }>);
    if (conflict) return NextResponse.json({ error: conflict }, { status: 409 });
  }

  changes.nom = nom;
  changes.classe_id = classeId;
  changes.jour_semaine = day;
  changes.heure_debut = start;
  changes.heure_fin = end;
  changes.salle = salle;
  changes.enseignant = enseignant;
  changes.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from("courses").update(changes).eq("id", id)
    .select("id,nom,classe_id,salle,jour_semaine,heure_debut,heure_fin,enseignant,archived_at,is_demo").single();
  if (error?.code === "23P01") return NextResponse.json({ error: "conflit_horaire_concurrent" }, { status: 409 });
  if (error) return NextResponse.json({ error: "modification_impossible" }, { status: 500 });
  const response = NextResponse.json({ course: data });
  if (auth.session) setSessionCookies(response, auth.session);
  return response;
}

export async function DELETE(request: NextRequest, context: Context) {
  const accessToken = requestAccessToken(request);
  const auth = await requireAdmin(accessToken, request.cookies.get(REFRESH_COOKIE)?.value);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await context.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "identifiant_invalide" }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "confirmation_requise" }, { status: 400 }); }
  if (!body || typeof body !== "object" || (body as { confirmation?: unknown }).confirmation !== "SUPPRIMER DEFINITIVEMENT") {
    return NextResponse.json({ error: "confirmation_requise" }, { status: 400 });
  }
  const supabase = createServerSupabase(auth.session?.access_token ?? accessToken);
  const { error } = await supabase.from("courses").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "suppression_impossible" }, { status: 500 });
  const response = NextResponse.json({ ok: true, history_deleted: true });
  if (auth.session) setSessionCookies(response, auth.session);
  return response;
}
