import { NextResponse, type NextRequest } from "next/server";
import {
  REFRESH_COOKIE,
  SESSION_COOKIE,
  createServerSupabase,
  setSessionCookies,
} from "@/lib/auth";

/**
 * Protection des routes admin (Sprint 1).
 * - `/dashboard` exige une session admin valide ;
 * - le JWT est vérifié auprès de Supabase (pas une simple présence de cookie) ;
 * - si l'access token est expiré, la session est renouvelée via le refresh
 *   token (cookie 8 h) et les cookies sont ré-écrits (rotation) ;
 * - les endpoints `/api/**` gèrent leur propre auth (401 JSON) ;
 * - la PWA scanner (`/scanner/`, fichiers statiques) s'authentifie elle-même
 *   via `/api/**`, elle n'est donc pas couverte par ce middleware.
 */

const PROTECTED_PAGES = ["/dashboard"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtectedPage = PROTECTED_PAGES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  if (!isProtectedPage) return NextResponse.next();

  const accessToken = request.cookies.get(SESSION_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!accessToken) return redirectToLogin(request);

  // Vérification réseau du JWT auprès de Supabase (source de vérité).
  const supabase = createServerSupabase(accessToken);
  const { data, error } = await supabase.auth.getUser(accessToken);
  let user = data?.user;
  let rotated: { access_token: string; refresh_token: string } | undefined;

  if ((error || !user) && refreshToken) {
    // Access token expiré → renouvellement silencieux (access + refresh tournés).
    const refreshed = await supabase.auth.refreshSession({ refresh_token: refreshToken });
    if (!refreshed.error && refreshed.data?.session && refreshed.data.user) {
      rotated = {
        access_token: refreshed.data.session.access_token,
        refresh_token: refreshed.data.session.refresh_token,
      };
      user = refreshed.data.user;
    }
  }

  if (!user) return redirectToLogin(request);

  // Check the authoritative role registry on every protected page request.
  // This revokes access immediately after demotion or deactivation, even while
  // a previously issued JWT is still cryptographically valid.
  const roleSupabase = createServerSupabase(rotated?.access_token ?? accessToken);
  const { data: roleRow, error: roleError } = await roleSupabase
    .from("app_user_roles")
    .select("role, is_active")
    .eq("user_id", user.id)
    .maybeSingle();
  if (roleError || !roleRow || roleRow.is_active !== true ||
      (roleRow.role !== "admin" && roleRow.role !== "dev")) {
    return redirectToLogin(request);
  }

  const response = NextResponse.next();
  if (rotated) setSessionCookies(response, rotated);
  return response;
}

function redirectToLogin(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
  const response = NextResponse.redirect(url);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
