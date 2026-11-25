import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_COOKIE, requestAccessToken, requireAdmin, createServerSupabase, setSessionCookies } from "@/lib/auth";

/** Minimal activity feed: column-level grants prevent ADMIN from reading audit payloads. */
export async function GET(request: NextRequest) {
  const accessToken = requestAccessToken(request);
  const auth = await requireAdmin(accessToken, request.cookies.get(REFRESH_COOKIE)?.value);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = createServerSupabase(auth.session?.access_token ?? accessToken);
  const { data, error } = await supabase.from("audit_logs")
    .select("id,actor_role,action,entity_table,entity_id,created_at")
    .order("created_at", { ascending: false })
    .limit(8);
  if (error) return NextResponse.json({ error: "activite_indisponible" }, { status: 500 });

  const response = NextResponse.json({ events: data ?? [] });
  if (auth.session) setSessionCookies(response, auth.session);
  return response;
}
