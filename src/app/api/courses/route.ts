import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_COOKIE, requestAccessToken, requireAdmin, createServerSupabase, setSessionCookies } from "@/lib/auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const DAY_NAMES = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

function minutes(time: string): number {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
}

function conflictMessage(
  course: { classe_id: string; enseignant?: string | null; salle?: string | null; heure_debut: string; heure_fin: string },
  other: { id: string; classe_id: string; enseignant?: string | null; salle?: string | null; heure_debut: string; heure_fin: string }
): string | null {
  const overlap = minutes(course.heure_debut) < minutes(other.heure_fin) &&
    minutes(course.heure_fin) > minutes(other.heure_debut);
  if (!overlap) return null;
  if (course.classe_id === other.classe_id) return `Conflit de créneau avec ${other.id} (même classe).`;
  if (course.enseignant && other.enseignant && course.enseignant.trim().toLocaleLowerCase() === other.enseignant.trim().toLocaleLowerCase()) {
    return `Conflit enseignant avec ${other.id}.`;
  }
  if (course.salle && other.salle && course.salle.trim().toLocaleLowerCase() === other.salle.trim().toLocaleLowerCase()) {
    return `Conflit de salle avec ${other.id}.`;
  }
  return null;
}

async function findConflict(
  supabase: ReturnType<typeof createServerSupabase>,
  course: { id?: string; classe_id: string; enseignant?: string | null; salle?: string | null; jour_semaine: number; heure_debut: string; heure_fin: string; is_demo: boolean }
): Promise<string | null> {
  const { data, error } = await supabase.from("courses")
    .select("id,classe_id,enseignant,salle,heure_debut,heure_fin")
    .eq("jour_semaine", course.jour_semaine)
    .eq("is_demo", course.is_demo)
    .is("archived_at", null);
  if (error) return "vérification_conflits_indisponible";
  for (const other of data ?? []) {
    if (other.id === course.id) continue;
    const conflict = conflictMessage(course, other);
    if (conflict) return conflict;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const accessToken = requestAccessToken(request);
  const auth = await requireAdmin(accessToken, request.cookies.get(REFRESH_COOKIE)?.value);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const params = request.nextUrl.searchParams;
  const includeDemo = auth.user.role === "dev" && params.get("demo") === "1";
  const archived = params.get("archived") === "1";
  const page = Math.max(1, Number(params.get("page") ?? 1));
  const perPage = Math.max(1, Math.min(100, Number(params.get("perPage") ?? 50)));
  const q = (params.get("q") ?? "").replace(/[,%()]/g, " ").trim().slice(0, 80);

  let query = createServerSupabase(auth.session?.access_token ?? accessToken)
    .from("courses")
    .select("id,nom,classe_id,salle,jour_semaine,heure_debut,heure_fin,enseignant,archived_at,is_demo,classes(id,nom)", { count: "exact" })
    .order("jour_semaine").order("heure_debut")
    .range((page - 1) * perPage, page * perPage - 1);
  if (!includeDemo) query = query.eq("is_demo", false);
  query = archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  if (params.get("classe")) query = query.eq("classe_id", params.get("classe")!);
  if (params.get("jour") !== null && params.get("jour") !== "") {
    const day = Number(params.get("jour"));
    if (!Number.isInteger(day) || day < 0 || day > 6) return NextResponse.json({ error: "jour_invalide" }, { status: 400 });
    query = query.eq("jour_semaine", day);
  }
  if (q) query = query.ilike("nom", `%${q}%`);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: "erreur_base" }, { status: 500 });
  const response = NextResponse.json({ courses: data ?? [], page, perPage, total: count ?? 0, jours: DAY_NAMES });
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
  const nom = typeof body.nom === "string" ? body.nom.trim() : "";
  const classeId = typeof body.classe_id === "string" ? body.classe_id : "";
  const day = Number(body.jour_semaine);
  const heureDebut = typeof body.heure_debut === "string" ? body.heure_debut : "";
  const heureFin = typeof body.heure_fin === "string" ? body.heure_fin : "";
  const salle = body.salle === undefined || body.salle === "" ? null : typeof body.salle === "string" ? body.salle.trim() : undefined;
  const enseignant = body.enseignant === undefined || body.enseignant === "" ? null : typeof body.enseignant === "string" ? body.enseignant.trim() : undefined;
  const isDemo = auth.user.role === "dev" && body.is_demo === true;
  if (!nom || nom.length > 120 || !UUID.test(classeId) || !Number.isInteger(day) || day < 0 || day > 6 ||
      !TIME.test(heureDebut) || !TIME.test(heureFin) || minutes(heureDebut) >= minutes(heureFin) ||
      salle === undefined || (typeof salle === "string" && salle.length > 64) ||
      enseignant === undefined || (typeof enseignant === "string" && enseignant.length > 120)) {
    return NextResponse.json({ error: "champs_invalides" }, { status: 400 });
  }

  const supabase = createServerSupabase(auth.session?.access_token ?? accessToken);
  const { data: classroom } = await supabase.from("classes").select("id,is_demo")
    .eq("id", classeId).is("archived_at", null).maybeSingle();
  if (!classroom || Boolean(classroom.is_demo) !== isDemo) return NextResponse.json({ error: "classe_invalide" }, { status: 400 });

  const conflict = await findConflict(supabase, {
    classe_id: classeId, enseignant, salle, jour_semaine: day,
    heure_debut: heureDebut, heure_fin: heureFin, is_demo: isDemo,
  });
  if (conflict) return NextResponse.json({ error: conflict }, { status: 409 });

  const { data, error } = await supabase.from("courses").insert({
    nom, classe_id: classeId, jour_semaine: day, heure_debut: heureDebut, heure_fin: heureFin,
    salle, enseignant, is_demo: isDemo,
  }).select("id,nom,classe_id,salle,jour_semaine,heure_debut,heure_fin,enseignant,is_demo,archived_at").single();
  if (error) return NextResponse.json({ error: "creation_impossible" }, { status: 500 });
  const response = NextResponse.json({ course: data }, { status: 201 });
  if (auth.session) setSessionCookies(response, auth.session);
  return response;
}
