import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_COOKIE, requestAccessToken, requireAdmin, createServerSupabase, setSessionCookies } from "@/lib/auth";

type ImportRow = {
  nom?: unknown;
  prenom?: unknown;
  code_qr?: unknown;
  classe_id?: unknown;
  email?: unknown;
  telephone?: unknown;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  const accessToken = requestAccessToken(request);
  const auth = await requireAdmin(accessToken, request.cookies.get(REFRESH_COOKIE)?.value);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let payload: unknown;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: "corps_invalide" }, { status: 400 }); }
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { rows?: unknown }).rows)) {
    return NextResponse.json({ error: "lignes_requises" }, { status: 400 });
  }
  const input = (payload as { rows: ImportRow[] }).rows;
  if (input.length < 1 || input.length > 500) return NextResponse.json({ error: "limite_import_500" }, { status: 400 });

  const demo = auth.user.role === "dev" && (payload as { demo?: unknown }).demo === true;
  const errors: Array<{ row: number; error: string }> = [];
  const seenCodes = new Set<string>();
  const rows: Array<{ nom: string; prenom: string | null; code_qr: string; classe_id: string; email: string | null; telephone: string | null; is_demo: boolean }> = [];

  input.forEach((row, index) => {
    const nom = typeof row.nom === "string" ? row.nom.trim() : "";
    const prenom = typeof row.prenom === "string" && row.prenom.trim() ? row.prenom.trim() : null;
    const code = typeof row.code_qr === "string" ? row.code_qr.trim() : "";
    const classe = typeof row.classe_id === "string" ? row.classe_id : "";
    const email = typeof row.email === "string" && row.email.trim() ? row.email.trim().toLowerCase() : null;
    const telephone = typeof row.telephone === "string" && row.telephone.trim() ? row.telephone.trim() : null;
    if (!nom || nom.length > 100) errors.push({ row: index + 2, error: "nom_invalide" });
    if (!code || code.length > 64) errors.push({ row: index + 2, error: "matricule_invalide" });
    if (code && seenCodes.has(code)) errors.push({ row: index + 2, error: "doublon_dans_le_fichier" });
    if (code) seenCodes.add(code);
    if (!UUID.test(classe)) errors.push({ row: index + 2, error: "classe_invalide" });
    if (email && !EMAIL.test(email)) errors.push({ row: index + 2, error: "email_invalide" });
    if (telephone && telephone.length > 32) errors.push({ row: index + 2, error: "telephone_invalide" });
    if (nom && code && UUID.test(classe) && (!email || EMAIL.test(email)) && (!telephone || telephone.length <= 32)) {
      rows.push({ nom, prenom, code_qr: code, classe_id: classe, email, telephone, is_demo: demo });
    }
  });

  const supabase = createServerSupabase(auth.session?.access_token ?? accessToken);
  const classIds = [...new Set(rows.map((row) => row.classe_id))];
  const [{ data: classes, error: classesError }, { data: existing, error: existingError }] = await Promise.all([
    supabase.from("classes").select("id,is_demo").in("id", classIds).is("archived_at", null),
    supabase.from("students").select("code_qr").in("code_qr", [...seenCodes]),
  ]);
  if (classesError || existingError) return NextResponse.json({ error: "verification_base_indisponible" }, { status: 500 });
  const classMap = new Map((classes ?? []).map((c) => [c.id, Boolean(c.is_demo)]));
  for (const [index, row] of rows.entries()) {
    if (classMap.get(row.classe_id) !== demo) errors.push({ row: index + 2, error: "classe_inconnue_ou_incompatible" });
  }
  const existingCodes = new Set((existing ?? []).map((s) => s.code_qr));
  for (const [index, row] of rows.entries()) {
    if (existingCodes.has(row.code_qr)) errors.push({ row: index + 2, error: "matricule_deja_existant" });
  }
  if (errors.length) return NextResponse.json({ error: "import_refuse", total: input.length, errors }, { status: 422 });

  const { data, error } = await supabase.from("students").insert(rows)
    .select("id,nom,prenom,code_qr,classe_id");
  if (error) return NextResponse.json({ error: error.code === "23505" ? "matricule_deja_existant" : "import_impossible" }, { status: error.code === "23505" ? 409 : 500 });

  const response = NextResponse.json({ ok: true, imported: data?.length ?? 0 }, { status: 201 });
  if (auth.session) setSessionCookies(response, auth.session);
  return response;
}
