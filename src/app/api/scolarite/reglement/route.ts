import { NextResponse, type NextRequest } from "next/server";
import {
  REFRESH_COOKIE,
  SESSION_COOKIE,
  requestAccessToken,
  createServerSupabase,
  requireAdmin,
  setSessionCookies,
} from "@/lib/auth";
import { isReglementDuplicate, validateReglement } from "@/lib/scolarite";

/**
 * POST /api/scolarite/reglement — enregistre un règlement (frais de scolarité).
 * Corps : { student_id, fee_id, montant_gnf, recu_le, note? }.
 *
 * Le doublon (même élève + frais + montant + date) n'est PAS rejeté : il est
 * inséré puis signalé (`doublon: true`) pour que l'agent confirme la saisie.
 * Aucune donnée de paiement sensible n'est acceptée (montant + date seulement).
 *
 * Note : dépend de la table `payments`
 * (supabase/migrations/2026-11-16_frais_scolarite.sql).
 */

type Body = {
  student_id?: string;
  fee_id?: string;
  montant_gnf?: number;
  recu_le?: string;
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

  const valid = validateReglement(body);
  if (!valid.ok) {
    return NextResponse.json({ error: valid.error }, { status: 400 });
  }

  const supabase = createServerSupabase(auth.session?.access_token ?? accessToken);

  const { data: existing, error: readError } = await supabase
    .from("payments")
    .select("id, student_id, fee_id, montant_gnf, recu_le, note")
    .eq("student_id", body.student_id!)
    .eq("fee_id", body.fee_id!);
  if (readError) {
    return NextResponse.json({ error: "erreur_base" }, { status: 500 });
  }

  const doublon = isReglementDuplicate((existing ?? []) as never, {
    student_id: body.student_id!,
    fee_id: body.fee_id!,
    montant_gnf: body.montant_gnf!,
    recu_le: body.recu_le!,
  });

  const { error: insertError } = await supabase.from("payments").insert({
    student_id: body.student_id,
    fee_id: body.fee_id,
    montant_gnf: body.montant_gnf,
    recu_le: body.recu_le,
    note: body.note ?? null,
  });
  if (insertError) {
    return NextResponse.json({ error: "erreur_base" }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true, doublon }, { status: 201 });
  if (auth.session) setSessionCookies(response, auth.session);
  return response;
}
