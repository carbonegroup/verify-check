import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_COOKIE, requestAccessToken, requireAdmin, setSessionCookies } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { isIsoDate } from "@/lib/dashboard";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(requestAccessToken(request), request.cookies.get(REFRESH_COOKIE)?.value);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.user.role !== "dev") return NextResponse.json({ error: "role_dev_requis" }, { status: 403 });

  const params = request.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get("page") ?? 1));
  const perPage = Math.max(1, Math.min(100, Number(params.get("perPage") ?? 50)));
  const from = params.get("from");
  const to = params.get("to");
  if ((from && !isIsoDate(from)) || (to && !isIsoDate(to)) || (from && to && from > to)) {
    return NextResponse.json({ error: "periode_invalide" }, { status: 400 });
  }
  try {
    const admin = createSupabaseAdmin();
    let query = admin.from("audit_logs").select(
      "id,actor_id,actor_role,action,entity_table,entity_id,old_data,new_data,reason,created_at",
      { count: "exact" }
    ).order("created_at", { ascending: false }).range((page - 1) * perPage, page * perPage - 1);
    if (params.get("action")) query = query.eq("action", params.get("action")!);
    if (params.get("entity")) query = query.eq("entity_table", params.get("entity")!);
    if (params.get("actor")) query = query.eq("actor_id", params.get("actor")!);
    if (params.get("entityId")) query = query.eq("entity_id", params.get("entityId")!);
    if (from) query = query.gte("created_at", `${from}T00:00:00Z`);
    if (to) query = query.lt("created_at", `${to}T23:59:59.999Z`);
    const { data, error, count } = await query;
    if (error) return NextResponse.json({ error: "journal_indisponible" }, { status: 500 });
    const response = NextResponse.json({ events: data ?? [], page, perPage, total: count ?? 0 });
    if (auth.session) setSessionCookies(response, auth.session);
    return response;
  } catch {
    return NextResponse.json({ error: "configuration_admin_indisponible" }, { status: 503 });
  }
}
