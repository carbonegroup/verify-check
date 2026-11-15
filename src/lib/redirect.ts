/**
 * Cible de redirection sûre après connexion (paramètre `next`).
 * N'accepte qu'un chemin interne : rejette les URL absolues et
 * protocol-relative (`//evil.com`) pour empêcher un open redirect.
 * Les backslashes sont rejetés car les navigateurs normalisent `\` en `/`,
 * si bien que `/\evil.com` résout vers `https://evil.com/`.
 */
export function safeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/dashboard";
  }
  return value;
}
