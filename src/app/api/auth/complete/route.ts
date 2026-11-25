import { NextResponse, type NextRequest } from "next/server";
import {
  createServerSupabase,
  requireAdmin,
  setSessionCookies,
} from "@/lib/auth";
import { applyRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const rateLimit = applyRateLimit(request, { max: 5, windowMs: 60_000, keyPrefix: "auth:complete-account" });
  if (!rateLimit.allowed) return NextResponse.json({ error: "trop_de_requetes" }, { status: 429 });

  let payload: unknown;
  try { payload = await request.json(); } catch {
    return NextResponse.json({ error: "corps_invalide" }, { status: 400 });
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "corps_invalide" }, { status: 400 });
  }
  const body = payload as {
    access_token?: unknown;
    refresh_token?: unknown;
    type?: unknown;
    new_password?: unknown;
    confirm_password?: unknown;
  };
  if (typeof body.access_token !== "string" || body.access_token.length < 20 ||
      typeof body.refresh_token !== "string" || body.refresh_token.length < 20 ||
      (body.type !== "invite" && body.type !== "recovery") ||
      typeof body.new_password !== "string" || body.new_password.length < 12 || body.new_password.length > 128 ||
      body.new_password !== body.confirm_password) {
    return NextResponse.json({ error: "champs_invalides" }, { status: 400 });
  }

  const auth = await requireAdmin(body.access_token, body.refresh_token);
  if (!auth.ok) return NextResponse.json({ error: auth.error, status: auth.status }, { status: auth.status });

  const activeSession = auth.session ?? {
    access_token: body.access_token,
    refresh_token: body.refresh_token,
  };
  const supabase = createServerSupabase();
  const { error: sessionError } = await supabase.auth.setSession(activeSession);
  if (sessionError) return NextResponse.json({ error: "lien_expire_ou_invalide" }, { status: 401 });

  const { error: updateError } = await supabase.auth.updateUser({ password: body.new_password });
  if (updateError) return NextResponse.json({ error: "definition_mot_de_passe_impossible" }, { status: 400 });

  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session ?? activeSession;
  const response = NextResponse.json({
    ok: true,
    role: auth.user.role,
    message: body.type === "invite" ? "compte_active" : "mot_de_passe_reinitialise",
  });
  setSessionCookies(response, session);
  return response;
}
