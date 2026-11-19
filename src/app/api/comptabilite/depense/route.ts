import { NextResponse, type NextRequest } from "next/server";
import {
  REFRESH_COOKIE,
  requestAccessToken,
  createServerSupabase,
  requireAdmin,
  setSessionCookies,
} from "@/lib/auth";
import { validateDepense } from "@/lib/comptabilite";

/**
 * POST /api/comptabilite/depense — enregistre une dépense.
 * Corps : { libelle, categorie, montant_gnf, date_depense, note? }.
 * Aucune donnée sensible : libellé + montant GNF + date (+ note libre).
 * Dépend de la table `expenses`
 * (supabase/migrations/2026-11-16_depenses.sql).
 */

type Body = {
  libelle?: string;
  categorie?: string;
  montant_gnf?: number;
  date_depense?: string;
  note?: string;
};

export async function POST(request: NextRequest) {
  const accessToken = requestAccessToken(request);
  const auth = await requireAdmin(accessToken, request.cookies.get(REFRESH_COOKIE)?.value);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body) {
    return NextResponse.json({ error: "corps_invalide" }, { status: 400 });
  }

  const valid = validateDepense(body);
  if (!valid.ok) {
    return NextResponse.json({ error: valid.error }, { status: 400 });
  }

  const supabase = createServerSupabase(auth.session?.access_token ?? accessToken);
  const { error } = await supabase.from("expenses").insert({
    libelle: body.libelle,
    categorie: body.categorie,
    montant_gnf: body.montant_gnf,
    date_depense: body.date_depense,
    note: body.note ?? null,
  });
  if (error) {
    return NextResponse.json({ error: "erreur_base" }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true }, { status: 201 });
  if (auth.session) setSessionCookies(response, auth.session);
  return response;
}
