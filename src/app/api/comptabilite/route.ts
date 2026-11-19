import { NextResponse, type NextRequest } from "next/server";
import {
  REFRESH_COOKIE,
  requestAccessToken,
  createServerSupabase,
  requireAdmin,
  setSessionCookies,
} from "@/lib/auth";
import { buildComptabilite } from "@/lib/comptabilite";

/**
 * GET /api/comptabilite — service comptabilité (recettes + dépenses + solde).
 * Params : from?, to? (dates ISO, période inclusive).
 * Réponse : grand livre, dépenses par catégorie, totaux (recettes/dépenses/solde).
 * Accès protégé par la session admin ; RLS filtre côté base.
 *
 * Recettes = règlements de frais (`payments`, voir scolarité).
 * Dépenses = table `expenses` (supabase/migrations/2026-11-16_depenses.sql).
 * Tant que les migrations ne sont pas appliquées, l'endpoint répond `erreur_base`.
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

  const response = NextResponse.json(result);
  if (auth.session) setSessionCookies(response, auth.session);
  return response;
}
