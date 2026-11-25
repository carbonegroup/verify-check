import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_COOKIE, requestAccessToken, requireAdmin, setSessionCookies, createServerSupabase } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  const auth = await requireAdmin(requestAccessToken(request), request.cookies.get(REFRESH_COOKIE)?.value);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.user.role !== "dev") return NextResponse.json({ error: "role_dev_requis" }, { status: 403 });

  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "identifiant_invalide" }, { status: 400 });
  }

  try {
    const admin = createSupabaseAdmin();
    const { data, error } = await admin.auth.admin.getUserById(id);
    const email = data.user?.email;
    if (error || !email) return NextResponse.json({ error: "compte_introuvable" }, { status: 404 });

    const publicClient = createServerSupabase();
    const { error: resetError } = await publicClient.auth.resetPasswordForEmail(email);
    if (resetError) return NextResponse.json({ error: "envoi_reinitialisation_echoue" }, { status: 502 });

    await admin.from("audit_logs").insert({
      actor_id: auth.user.id,
      actor_role: "dev",
      action: "PASSWORD_RESET",
      entity_table: "auth.users",
      entity_id: id,
      new_data: { requested: true },
    });

    const response = NextResponse.json({ ok: true });
    if (auth.session) setSessionCookies(response, auth.session);
    return response;
  } catch {
    return NextResponse.json({ error: "configuration_admin_indisponible" }, { status: 503 });
  }
}
