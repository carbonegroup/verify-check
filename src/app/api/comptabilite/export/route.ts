import { NextResponse, type NextRequest } from "next/server";
import {
  REFRESH_COOKIE,
  requestAccessToken,
  createServerSupabase,
  requireAdmin,
  setSessionCookies,
} from "@/lib/auth";
import { buildComptabilite, buildComptabiliteCsv } from "@/lib/comptabilite";
import { isIsoDate } from "@/lib/dashboard";

/**
 * GET /api/comptabilite/export — export CSV du grand livre (recettes + dépenses).
 * Params : from?, to?.
 */

export async function GET(request: NextRequest) {
  const accessToken = requestAccessToken(request);
  const auth = await requireAdmin(accessToken, request.cookies.get(REFRESH_COOKIE)?.value);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const params = request.nextUrl.searchParams;
  const from = params.get("from") ?? undefined;
  const to = params.get("to") ?? undefined;
  if ((from && !isIsoDate(from)) || (to && !isIsoDate(to)) || (from && to && from > to)) {
    return NextResponse.json({ error: "periode_invalide" }, { status: 400 });
  }

  const supabase = createServerSupabase(auth.session?.access_token ?? accessToken);
  const [recettesRes, depensesRes] = await Promise.all([
    supabase.from("payments").select("id, montant_gnf, recu_le"),
    supabase.from("expenses").select("id, libelle, categorie, montant_gnf, date_depense, note"),
  ]);
  if (recettesRes.error || depensesRes.error) {
    return NextResponse.json({ error: "erreur_base" }, { status: 500 });
  }

  const result = buildComptabilite(
    {
      recettes: (recettesRes.data ?? []) as never,
      depenses: (depensesRes.data ?? []) as never,
    },
    { from, to }
  );

  const suffix = from || to ? `-${from ?? "debut"}_${to ?? "fin"}` : "";
  const response = new NextResponse(buildComptabiliteCsv(result.ecritures), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="comptabilite${suffix}.csv"`,
    },
  });
  if (auth.session) setSessionCookies(response, auth.session);
  return response;
}
