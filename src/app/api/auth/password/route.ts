import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  REFRESH_COOKIE,
  requestAccessToken,
  requireAdmin,
  createServerSupabase,
  setSessionCookies,
  supabaseAnonKey,
  supabaseUrl,
} from "@/lib/auth";
import { applyRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const accessToken = requestAccessToken(request);
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  const auth = await requireAdmin(accessToken, refreshToken);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rateLimit = applyRateLimit(request, { max: 5, windowMs: 60_000, keyPrefix: "auth:password-change" });
  if (!rateLimit.allowed) return NextResponse.json({ error: "trop_de_requetes" }, { status: 429 });

  let payload: unknown;
  try { payload = await request.json(); } catch {
    return NextResponse.json({ error: "corps_invalide" }, { status: 400 });
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "corps_invalide" }, { status: 400 });
  }
  const body = payload as { current_password?: unknown; new_password?: unknown; confirm_password?: unknown };
  if (typeof body.current_password !== "string" || !body.current_password ||
      typeof body.new_password !== "string" || body.new_password.length < 12 || body.new_password.length > 128 ||
      body.new_password !== body.confirm_password) {
    return NextResponse.json({ error: "champs_invalides" }, { status: 400 });
  }
  if (!auth.user.email) return NextResponse.json({ error: "email_compte_indisponible" }, { status: 400 });

  const verifier = createClient(supabaseUrl(), supabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: verified, error: verifyError } = await verifier.auth.signInWithPassword({
    email: auth.user.email,
    password: body.current_password,
  });
  if (verifyError || verified.user?.id !== auth.user.id) {
    return NextResponse.json({ error: "mot_de_passe_actuel_incorrect" }, { status: 401 });
  }

  const effectiveAccessToken = auth.session?.access_token ?? accessToken;
  const effectiveRefreshToken = auth.session?.refresh_token ?? refreshToken;
  if (!effectiveAccessToken || !effectiveRefreshToken) {
    return NextResponse.json({ error: "session_invalide" }, { status: 401 });
  }

  const supabase = createServerSupabase();
  const { error: sessionError } = await supabase.auth.setSession({
    access_token: effectiveAccessToken,
    refresh_token: effectiveRefreshToken,
  });
  if (sessionError) return NextResponse.json({ error: "session_invalide" }, { status: 401 });

  const { error: updateError } = await supabase.auth.updateUser({ password: body.new_password });
  if (updateError) return NextResponse.json({ error: "modification_mot_de_passe_impossible" }, { status: 400 });

  const response = NextResponse.json({ ok: true, message: "mot_de_passe_modifie" });
  if (auth.session) setSessionCookies(response, auth.session);
  return response;
}
