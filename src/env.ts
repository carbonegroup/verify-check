/**
 * Validation des variables d'environnement au démarrage.
 * Échoue immédiatement (fail fast) si une variable requise est manquante ou invalide.
 * À importer au tout début de l'application (ex. dans layout.tsx ou middleware.ts).
 */

const REQUIRED_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: {
    validate: (v: string) => v.startsWith("https://") && v.includes(".supabase.co"),
    error: "NEXT_PUBLIC_SUPABASE_URL doit être une URL Supabase valide (https://xxx.supabase.co)",
  },
  NEXT_PUBLIC_SUPABASE_ANON_KEY: {
    validate: (v: string) => v.length > 20 && (v.startsWith("eyJ") || v.startsWith("sb_publishable_")),
    error: "NEXT_PUBLIC_SUPABASE_ANON_KEY doit être une clé Supabase valide (commence par eyJ ou sb_publishable_)",
  },
} as const;

type EnvKey = keyof typeof REQUIRED_ENV;

/**
 * Valide les variables d'environnement.
 * À appeler explicitement au démarrage de l'app (layout.tsx, middleware.ts).
 * Ne s'exécute PAS à l'import pour permettre les tests sans variables d'env.
 */
export function validateEnv(): void {
  const missing: string[] = [];
  const invalid: { key: string; value: string }[] = [];

  for (const key of Object.keys(REQUIRED_ENV)) {
    const value = process.env[key];
    if (!value) {
      missing.push(key);
      continue;
    }
    const { validate } = REQUIRED_ENV[key as EnvKey];
    if (!validate(value)) {
      invalid.push({ key, value: value.slice(0, 10) + "..." });
    }
  }

  if (missing.length > 0 || invalid.length > 0) {
    const lines = [
      "❌ Variables d'environnement invalides ou manquantes :",
      ...missing.map((k) => `  - ${k}: ABSENTE`),
      ...invalid.map(({ key, value }) => `  - ${key}: INVALIDE (${value}) — ${REQUIRED_ENV[key as EnvKey].error}`),
      "",
      "Créez un fichier .env.local à la racine avec :",
      "  NEXT_PUBLIC_SUPABASE_URL=https://VOTRE-PROJET.supabase.co",
      "  NEXT_PUBLIC_SUPABASE_ANON_KEY=VOTRE_CLE_ANON_SUPABASE",
    ];
    throw new Error(lines.join("\n"));
  }
}

/** Accès typé aux variables validées (après validateEnv()). */
export function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`${key} non définie (validation aurait dû échouer plus tôt)`);
  return value;
}

export const Env = {
  SUPABASE_URL: () => getEnv("NEXT_PUBLIC_SUPABASE_URL"),
  SUPABASE_ANON_KEY: () => getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
} as const;