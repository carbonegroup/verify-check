import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_COOKIE, requestAccessToken, requireAdmin, createServerSupabase, setSessionCookies } from "@/lib/auth";
import { isValidEmailAddress } from "@/lib/validation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= max;
}

export async function GET(request: NextRequest) {
  const accessToken = requestAccessToken(request);
  const auth = await requireAdmin(accessToken, request.cookies.get(REFRESH_COOKIE)?.value);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const params = request.nextUrl.searchParams;
  const includeDemo = auth.user.role === "dev" && params.get("demo") === "1";
  const archived = params.get("archived") === "1";
  const page = Math.max(1, Number(params.get("page") ?? 1));
  const perPage = Math.max(1, Math.min(100, Number(params.get("perPage") ?? 25)));
  const q = (params.get("q") ?? "").replace(/[,%()]/g, " ").trim().slice(0, 80);
  let query = createServerSupabase(auth.session?.access_token ?? accessToken)
    .from("students")
    .select("id, nom, prenom, code_qr, classe_id, email, telephone, photo_url, archived_at, is_demo, created_at", { count: "exact" })
    .order("nom")
    .range((page - 1) * perPage, page * perPage - 1);
  query = query.eq("is_demo", includeDemo);
  query = archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  if (params.get("classe")) query = query.eq("classe_id", params.get("classe")!);
  if (q) query = query.or(`nom.ilike.%${q}%,prenom.ilike.%${q}%,code_qr.ilike.%${q}%,email.ilike.%${q}%`);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: "erreur_base" }, { status: 500 });
  const response = NextResponse.json({ students: data ?? [], page, perPage, total: count ?? 0 });
  if (auth.session) setSessionCookies(response, auth.session);
  return response;
}

export async function POST(request: NextRequest) {
  const accessToken = requestAccessToken(request);
  const auth = await requireAdmin(accessToken, request.cookies.get(REFRESH_COOKIE)?.value);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  let payload: unknown;
  try { payload = await request.json(); } catch {
    return NextResponse.json({ error: "corps_invalide" }, { status: 400 });
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return NextResponse.json({ error: "corps_invalide" }, { status: 400 });
  const body = payload as Record<string, unknown>;
  const nom = validText(body.nom, 100) ? body.nom.trim() : "";
  const prenom = body.prenom === undefined || body.prenom === "" ? null : validText(body.prenom, 100) ? body.prenom.trim() : undefined;
  const classeId = typeof body.classe_id === "string" ? body.classe_id : "";
  const codeQr = body.code_qr === undefined || body.code_qr === "" ? `VC-${crypto.randomUUID().toUpperCase()}` : validText(body.code_qr, 64) ? body.code_qr.trim() : "";
  const email = body.email === undefined || body.email === "" ? null : typeof body.email === "string" && isValidEmailAddress(body.email.trim()) ? body.email.trim().toLowerCase() : undefined;
  const telephone = body.telephone === undefined || body.telephone === "" ? null : validText(body.telephone, 32) ? body.telephone.trim() : undefined;
  const isDemo = auth.user.role === "dev" && body.is_demo === true;

  if (!nom || !UUID.test(classeId) || !codeQr || prenom === undefined || email === undefined || telephone === undefined) {
    return NextResponse.json({ error: "champs_invalides" }, { status: 400 });
  }

  const supabase = createServerSupabase(auth.session?.access_token ?? accessToken);
  const { data: classroom, error: classError } = await supabase.from("classes")
    .select("id,is_demo").eq("id", classeId).is("archived_at", null).maybeSingle();
  if (classError || !classroom || Boolean(classroom.is_demo) !== isDemo) {
    return NextResponse.json({ error: "classe_invalide" }, { status: 400 });
  }

  const { data, error } = await supabase.from("students").insert({
    nom, prenom, code_qr: codeQr, classe_id: classeId, email, telephone, is_demo: isDemo,
  }).select("id,nom,prenom,code_qr,classe_id,email,telephone,photo_url,is_demo,created_at").single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "matricule_duplique" : "creation_impossible" }, { status: error.code === "23505" ? 409 : 500 });
  const response = NextResponse.json({ student: data }, { status: 201 });
  if (auth.session) setSessionCookies(response, auth.session);
  return response;
}
