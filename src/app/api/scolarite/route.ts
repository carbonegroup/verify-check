import { NextResponse, type NextRequest } from "next/server";
import {
  REFRESH_COOKIE,
  requestAccessToken,
  createServerSupabase,
  requireAdmin,
  setSessionCookies,
} from "@/lib/auth";
import { buildScolarite, type StatutFrais } from "@/lib/scolarite";

/**
 * GET /api/scolarite — service scolarité (frais).
 * Params : classe?, statut? (regle | partiel | impaye | sans-frais).
 * Réponse : lignes par élève (attendu / réglé / solde / statut), résumé par
 * classe et totaux. Accès protégé par la session admin ; RLS filtre côté base.
 *
 * Note : dépend des tables `fees` et `payments`
 * (supabase/migrations/2026-11-16_frais_scolarite.sql). Tant que la migration
 * n'est pas appliquée, l'endpoint répond `erreur_base` (500).
 */

const STATUTS: StatutFrais[] = ["regle", "partiel", "impaye", "sans-frais"];

export async function GET(request: NextRequest) {
  const accessToken = requestAccessToken(request);
  const auth = await requireAdmin(accessToken, request.cookies.get(REFRESH_COOKIE)?.value);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const params = request.nextUrl.searchParams;
  const classe = params.get("classe") ?? undefined;
  const statutParam = params.get("statut");
  const statut = STATUTS.includes(statutParam as StatutFrais)
    ? (statutParam as StatutFrais)
    : undefined;

  const supabase = createServerSupabase(auth.session?.access_token ?? accessToken);
  const [classesRes, elevesRes, fraisRes, reglementsRes] = await Promise.all([
    supabase.from("classes").select("id, nom").order("nom"),
    supabase.from("students").select("id, nom, classe_id").order("nom"),
    supabase.from("fees").select("id, classe_id, libelle, annee_scolaire, montant_gnf, echeance"),
    supabase.from("payments").select("id, student_id, fee_id, montant_gnf, recu_le, note"),
  ]);

  if (classesRes.error || elevesRes.error || fraisRes.error || reglementsRes.error) {
    return NextResponse.json({ error: "erreur_base" }, { status: 500 });
  }

  const result = buildScolarite(
    {
      classes: (classesRes.data ?? []) as never,
      eleves: (elevesRes.data ?? []) as never,
      frais: (fraisRes.data ?? []) as never,
      reglements: (reglementsRes.data ?? []) as never,
    },
    { classe, statut }
  );

  const response = NextResponse.json(result);
  if (auth.session) setSessionCookies(response, auth.session);
  return response;
}
