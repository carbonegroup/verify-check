/**
 * Config de l'app mobile : lecture unique des variables `EXPO_PUBLIC_*`.
 * Aucun identifiant codé en dur ; voir mobile/.env.example.
 *
 * IMPORTANT : chaque variable est lue via un accès STATIQUE à process.env
 * (process.env.EXPO_PUBLIC_*) pour que Metro/Expo puisse l'inliner dans le
 * bundle au build. Un accès dynamique (env[name]) ne serait PAS inliné.
 */

import { readConfig, type AppConfig } from "./config";

let cached: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!cached) {
    cached = readConfig({
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
    });
  }
  return cached;
}

/** Pour les tests : réinitialise le cache de config. */
export function resetConfigCache(): void {
  cached = null;
}
