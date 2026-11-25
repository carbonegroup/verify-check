import { NextResponse, type NextRequest } from "next/server";
import {
  REFRESH_COOKIE,
  requestAccessToken,
  requireAdmin,
  setSessionCookies,
} from "@/lib/auth";

function isSecureAccountRedirect(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.pathname.endsWith("/auth/complete")
      && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** DEV-only, read-only environment diagnostics. Never returns secret values. */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(
    requestAccessToken(request),
    request.cookies.get(REFRESH_COOKIE)?.value
  );
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (auth.user.role !== "dev") {
    return NextResponse.json({ error: "role_dev_requis" }, { status: 403 });
  }

  const response = NextResponse.json({
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
    checks: [
      {
        id: "supabase-url",
        label: "URL Supabase publique",
        configured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
        required: true,
      },
      {
        id: "supabase-anon-key",
        label: "Clé publique Supabase",
        configured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
        required: true,
      },
      {
        id: "service-role",
        label: "Clé administrative serveur",
        configured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
        required: true,
      },
      {
        id: "auth-redirect",
        label: "URL de finalisation de compte HTTPS",
        configured: isSecureAccountRedirect(process.env.AUTH_ACCOUNT_REDIRECT_URL),
        required: true,
      },
    ],
  });
  if (auth.session) setSessionCookies(response, auth.session);
  return response;
}
