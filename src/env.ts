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
    validate: (v: string) => v.length > 20 && v.startsWith("eyJ"),
    error: "NEXT_PUBLIC_SUPABASE_ANON_KEY doit être une clé JWT Supabase valide (commence par eyJ)",
  },
} as const;

type EnvKey = keyof typeof REQUIRED_ENV;

function validateEnv(): void {
  const missing: EnvKey[] = [];
  const invalid: { key: EnvKey; value: string }[] = [];

  for (const key of Object.keys(REQUIRED_ENV) as EnvKey[]) {
    const value = process.env[key];
    if (!value) {
      missing.push(key);
      continue;
    }
    const { validate, error } = REQUIRED_ENV[key];
    if (!validate(value)) {
      invalid.push({ key, value: value.slice(0, 10) + "..." });
    }
  }

  if (missing.length > 0 || invalid.length > 0) {
    const lines = [
      "❌ Variables d'environnement invalides ou manquantes :",
      ...missing.map((k) => `  - ${k}: ABSENTE`),
      ...invalid.map(({ key, value }) => `  - ${key}: INVALIDE (${value}) — ${REQUIRED_ENV[key].error}`),
      "",
      "Créez un fichier .env.local à la racine avec :",
      "  NEXT_PUBLIC_SUPABASE_URL=https://VOTRE-PROJET.supabase.co",
      "  NEXT_PUBLIC_SUPABASE_ANON_KEY=VOTRE_CLE_ANON_SUPABASE",
    ];
    throw new Error(lines.join("\n"));
  }
}

// Exécution immédiate à l'import (fail fast)
validateEnv();

/** Accès typé aux variables validées. */
export function getEnv<K extends EnvKey>(key: K): string {
  const value = process.env[key];
  if (!value) throw new Error(`${key} non définie (validation aurait dû échouer plus tôt)`);
  return value;
}

export const Env = {
  SUPABASE_URL: () => getEnv("NEXT_PUBLIC_SUPABASE_URL"),
  SUPABASE_ANON_KEY: () => getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
} as const;