import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_COOKIE, requestAccessToken, requireAdmin, setSessionCookies } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(
    requestAccessToken(request),
    request.cookies.get(REFRESH_COOKIE)?.value
  );
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const response = NextResponse.json({
    user: { id: auth.user.id, email: auth.user.email },
    role: auth.user.role,
  });
  if (auth.session) setSessionCookies(response, auth.session);
  return response;
}
