import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_COOKIE, requestAccessToken, requireAdmin, setSessionCookies } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { applyRateLimit } from "@/lib/rate-limit";

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function requireDeveloper(request: NextRequest) {
  const auth = await requireAdmin(
    requestAccessToken(request),
    request.cookies.get(REFRESH_COOKIE)?.value
  );
  if (!auth.ok) return { response: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  if (auth.user.role !== "dev") {
    return { response: NextResponse.json({ error: "role_dev_requis" }, { status: 403 }) };
  }
  return { auth };
}

export async function GET(request: NextRequest) {
  const guard = await requireDeveloper(request);
  if (guard.response) return guard.response;

  try {
    const page = Math.max(1, Math.min(1000, Number(request.nextUrl.searchParams.get("page") ?? 1)));
    const perPage = Math.max(1, Math.min(100, Number(request.nextUrl.searchParams.get("perPage") ?? 50)));
    const search = (request.nextUrl.searchParams.get("q") ?? "").trim().toLocaleLowerCase();
    const admin = createSupabaseAdmin();
    const [{ data, error }, { data: roles, error: roleError }] = await Promise.all([
      admin.auth.admin.listUsers({ page, perPage }),
      admin.from("app_user_roles").select("user_id, role, is_active"),
    ]);
    if (error || roleError) {
      return NextResponse.json({ error: "erreur_comptes" }, { status: 500 });
    }
    const roleByUser = new Map((roles ?? []).map((r) => [r.user_id, r]));
    const users = (data.users ?? []).map((user) => {
      const roleRow = roleByUser.get(user.id);
      const role = roleRow?.role ?? (user.app_metadata?.role === "dev" ? "dev" : "admin");
      return {
        id: user.id,
        email: user.email ?? "",
        full_name: typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "",
        role,
        active: roleRow?.is_active === true && !user.banned_until,
        banned_until: user.banned_until ?? null,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at ?? null,
      };
    }).filter((user) => !search || user.email.toLocaleLowerCase().includes(search) || user.full_name.toLocaleLowerCase().includes(search));

    const response = NextResponse.json({ users, page, perPage, nextPage: users.length === perPage ? page + 1 : null });
    if (guard.auth?.session) setSessionCookies(response, guard.auth.session);
    return response;
  } catch {
    return NextResponse.json({ error: "configuration_admin_indisponible" }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireDeveloper(request);
  if (guard.response) return guard.response;
  const rl = applyRateLimit(request, { max: 10, windowMs: 60_000, keyPrefix: "admin:users:create" });
  if (!rl.allowed) return NextResponse.json({ error: "trop_de_requetes" }, { status: 429 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "corps_invalide" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "corps_invalide" }, { status: 400 });
  }
  const value = body as { email?: unknown; full_name?: unknown; role?: unknown };
  const email = typeof value.email === "string" ? value.email.trim().toLowerCase() : "";
  const fullName = typeof value.full_name === "string" ? value.full_name.trim() : "";
  const role = value.role;
  if (!isEmail(email) || fullName.length < 2 || fullName.length > 100 || (role !== "admin" && role !== "dev")) {
    return NextResponse.json({ error: "champs_invalides" }, { status: 400 });
  }

  try {
    const admin = createSupabaseAdmin();
    const { data: invitation, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
    });
    if (inviteError || !invitation.user) {
      return NextResponse.json({ error: inviteError?.message === "User already registered" ? "compte_existant" : "invitation_impossible" }, { status: 409 });
    }

    const userId = invitation.user.id;
    const previousMetadata = invitation.user.app_metadata ?? {};
    const { error: metadataError } = await admin.auth.admin.updateUserById(userId, {
      app_metadata: { ...previousMetadata, role },
    });
    if (metadataError) {
      return NextResponse.json({ error: "role_auth_non_enregistre" }, { status: 500 });
    }

    const { error: roleError } = await admin.from("app_user_roles").upsert({
      user_id: userId, role, is_active: true, updated_at: new Date().toISOString(),
    });
    if (roleError) {
      // No privileged row has been committed, so reverting metadata fails closed.
      await admin.auth.admin.updateUserById(userId, { app_metadata: previousMetadata });
      return NextResponse.json({ error: "role_non_enregistre_compte_invite_sans_acces" }, { status: 500 });
    }

    await admin.from("audit_logs").insert({
      actor_id: guard.auth?.user.id,
      actor_role: "dev",
      action: "INVITE",
      entity_table: "auth.users",
      entity_id: userId,
      new_data: { email, full_name: fullName, role },
    });

    const response = NextResponse.json({ ok: true, user: { id: userId, email, full_name: fullName, role, active: true } }, { status: 201 });
    if (guard.auth?.session) setSessionCookies(response, guard.auth.session);
    return response;
  } catch {
    return NextResponse.json({ error: "configuration_admin_indisponible" }, { status: 503 });
  }
}
