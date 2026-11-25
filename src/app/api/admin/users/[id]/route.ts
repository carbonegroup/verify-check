import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_COOKIE, requestAccessToken, requireAdmin, setSessionCookies } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

type Context = { params: Promise<{ id: string }> };

async function guardDev(request: NextRequest) {
  const auth = await requireAdmin(
    requestAccessToken(request),
    request.cookies.get(REFRESH_COOKIE)?.value
  );
  if (!auth.ok) return { response: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  if (auth.user.role !== "dev") return { response: NextResponse.json({ error: "role_dev_requis" }, { status: 403 }) };
  return { auth };
}

export async function PATCH(request: NextRequest, context: Context) {
  const guard = await guardDev(request);
  if (guard.response) return guard.response;
  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "identifiant_invalide" }, { status: 400 });
  }
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "corps_invalide" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "corps_invalide" }, { status: 400 });
  const value = body as { role?: unknown; active?: unknown };
  if (value.role !== undefined && value.role !== "admin" && value.role !== "dev") return NextResponse.json({ error: "role_invalide" }, { status: 400 });
  if (value.active !== undefined && typeof value.active !== "boolean") return NextResponse.json({ error: "statut_invalide" }, { status: 400 });
  if (value.role === undefined && value.active === undefined) return NextResponse.json({ error: "aucune_modification" }, { status: 400 });
  if (id === guard.auth?.user.id && (value.role !== undefined && value.role !== "dev" || value.active === false)) {
    return NextResponse.json({ error: "modification_propre_compte_interdite" }, { status: 409 });
  }

  try {
    const admin = createSupabaseAdmin();
    const { data: target, error: findError } = await admin.auth.admin.getUserById(id);
    if (findError || !target.user) return NextResponse.json({ error: "compte_introuvable" }, { status: 404 });

    const { data: currentRole } = await admin.from("app_user_roles").select("role,is_active").eq("user_id", id).maybeSingle();
    const oldRole = currentRole?.role ?? target.user.app_metadata?.role ?? "admin";
    const oldActive = currentRole?.is_active !== false && !target.user.banned_until;
    const nextRole = value.role === undefined ? oldRole : value.role;
    const nextActive = value.active === undefined ? oldActive : value.active;

    if (oldRole === "dev" && (nextRole !== "dev" || !nextActive) && oldActive) {
      const { count, error: countError } = await admin.from("app_user_roles")
        .select("user_id", { count: "exact", head: true })
        .eq("role", "dev")
        .eq("is_active", true);
      if (countError || (count ?? 0) <= 1) return NextResponse.json({ error: "dernier_dev_protege" }, { status: 409 });
    }

    const { error: registryError } = await admin.from("app_user_roles").upsert({
      user_id: id, role: nextRole, is_active: nextActive, updated_at: new Date().toISOString(),
    });
    if (registryError) return NextResponse.json({ error: "registre_role_indisponible" }, { status: 500 });

    const { error: authError } = await admin.auth.admin.updateUserById(id, {
      app_metadata: { ...(target.user.app_metadata ?? {}), role: nextRole },
      ban_duration: nextActive ? "none" : "876000h",
    });
    if (authError) {
      await admin.from("app_user_roles").upsert({ user_id: id, role: oldRole, is_active: oldActive });
      return NextResponse.json({ error: "mise_a_jour_auth_echouee" }, { status: 500 });
    }

    await admin.from("audit_logs").insert({
      actor_id: guard.auth?.user.id,
      actor_role: "dev",
      action: oldRole !== nextRole ? "ROLE_CHANGE" : nextActive ? "ACCOUNT_ENABLE" : "ACCOUNT_DISABLE",
      entity_table: "auth.users",
      entity_id: id,
      old_data: { role: oldRole, active: oldActive },
      new_data: { role: nextRole, active: nextActive },
    });

    const response = NextResponse.json({ ok: true, user: { id, role: nextRole, active: nextActive } });
    if (guard.auth?.session) setSessionCookies(response, guard.auth.session);
    return response;
  } catch {
    return NextResponse.json({ error: "configuration_admin_indisponible" }, { status: 503 });
  }
}
