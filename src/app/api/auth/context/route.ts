import { NextResponse, type NextRequest } from "next/server";
import {
  REFRESH_COOKIE,
  requestAccessToken,
  requireAdmin,
  setSessionCookies,
} from "@/lib/auth";

/**
 * GET /api/auth/context — returns the authoritative application role.
 * The role is read from app_user_roles by requireAdmin, not from editable
 * user metadata or a potentially stale app_metadata JWT claim.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(
    requestAccessToken(request),
    request.cookies.get(REFRESH_COOKIE)?.value
  );
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const response = NextResponse.json({ role: auth.user.role });
  if (auth.session) setSessionCookies(response, auth.session);
  return response;
}
