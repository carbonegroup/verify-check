"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { safeNext } from "@/lib/redirect";
import styles from "./login.module.css";

const ERROR_LABELS: Record<string, string> = {
  identifiants_invalides: "Email ou mot de passe incorrect.",
  role_admin_requis: "Ce compte n'a pas le rôle administrateur.",
  champs_requis: "Renseignez l'email et le mot de passe.",
};

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "erreur" }));
        setError(ERROR_LABELS[body.error] ?? "Connexion impossible.");
        return;
      }
      router.replace(next);
    } catch {
      setError("Réseau indisponible. Réessayez.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className={styles.card} aria-label="Connexion administrateur">
      <p className={styles.brand}>VerifyCheck · Direction</p>
      <h1 className={styles.subtitle}>Connexion administrateur</h1>

      <label htmlFor="email" className={styles.label}>
        Email
      </label>
      <input
        id="email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={styles.input}
      />

      <label htmlFor="password" className={styles.label}>
        Mot de passe
      </label>
      <input
        id="password"
        type="password"
        required
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className={styles.input}
      />

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className={styles.button}>
        {pending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
