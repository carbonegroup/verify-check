import { NextResponse, type NextRequest } from "next/server";
import {
  createServerSupabase,
  setSessionCookies,
  supabaseAnonKey,
  supabaseUrl,
} from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";
import { applyRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/auth/login — connexion admin (email + mot de passe).
 * Rejette tout compte dont `app_metadata.role` n'est pas `admin`.
 * Pose des cookies httpOnly (access + refresh) utilisés par le middleware et les endpoints.
 * Rate limited : 5 requêtes/minute par IP (brute-force protection).
 */

export async function POST(request: NextRequest) {
  // Rate limiting : 5 req/min pour protéger contre brute-force
  const rl = applyRateLimit(request, { max: 5, windowMs: 60_000, keyPrefix: "auth:login" });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "trop_de_requetes", retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000) },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "corps_invalide" }, { status: 400 });
  }
  const { email, password } = body;
  if (!email || !password) {
    return NextResponse.json({ error: "champs_requis" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl(), supabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data?.user || !data.session) {
    return NextResponse.json({ error: "identifiants_invalides" }, { status: 401 });
  }

  const role = (data.user.app_metadata as Record<string, unknown> | undefined)?.role;
  if (role !== "admin") {
    // Session créée mais rôle insuffisant : on la termine immédiatement.
    await supabase.auth.signOut().catch(() => {});
    return NextResponse.json({ error: "role_admin_requis" }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true });
  setSessionCookies(response, data.session);
  return response;
}
