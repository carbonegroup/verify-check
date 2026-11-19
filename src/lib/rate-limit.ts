/**
 * Rate limiter simple en mémoire (pour environnements serverless comme Vercel).
 * Note : en production multi-instances, utiliser Redis (Upstash, etc.).
 * Ici : Map en mémoire, suffisante pour le budget 0 $ (single instance Vercel free).
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 60_000; // 1 minute
const DEFAULT_MAX = 30; // 30 req/min par IP

const store = new Map<string, RateLimitEntry>();

/** Nettoie les entrées expirées (called occasionally). */
function cleanup(): void {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) store.delete(key);
  }
}

/**
 * Vérifie et incrémente le compteur pour une clé (ex. IP).
 * @returns { allowed: boolean, remaining: number, resetAt: number }
 */
export function rateLimit(
  key: string,
  options: { max?: number; windowMs?: number } = {}
): { allowed: boolean; remaining: number; resetAt: number } {
  const max = options.max ?? DEFAULT_MAX;
  const windowMs = options.windowMs ?? WINDOW_MS;
  const now = Date.now();

  cleanup();

  const entry = store.get(key);
  if (!entry || entry.resetAt < now) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: max - 1, resetAt };
  }

  if (entry.count >= max) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: max - entry.count, resetAt: entry.resetAt };
}

/** Extrait l'IP client d'une requête Next.js (support proxy). */
export function getClientIp(request: { headers: { get(name: string): string | null } }): string {
  // Vercel / proxies standards
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

/** Helper pour appliquer le rate limit et retourner une réponse 429 si dépassé. */
export function applyRateLimit(
  request: { headers: { get(name: string): string | null } },
  options: { max?: number; windowMs?: number; keyPrefix?: string } = {}
): { allowed: boolean; remaining: number; resetAt: number; ip: string } {
  const ip = getClientIp(request);
  const key = `${options.keyPrefix ?? "api"}:${ip}`;
  const result = rateLimit(key, { max: options.max, windowMs: options.windowMs });
  return { ...result, ip };
}