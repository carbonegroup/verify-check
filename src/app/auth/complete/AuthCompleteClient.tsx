"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/login/login.module.css";

type InviteSession = { accessToken: string; refreshToken: string; type: "invite" | "recovery" };

export default function AuthCompleteClient() {
  const router = useRouter();
  const [invite, setInvite] = useState<InviteSession | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [completed, setCompleted] = useState(false);

  // Read the one-time auth redirect fragment, then remove bearer tokens from the URL.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronize this page with the external Supabase redirect.
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = params.get("access_token") ?? "";
    const refreshToken = params.get("refresh_token") ?? "";
    const type = params.get("type");
    const linkError = params.get("error_description") ?? params.get("error");

    // Remove bearer tokens from the address bar immediately; keep them only in memory.
    window.history.replaceState({}, document.title, window.location.pathname);
    if (linkError) {
      setError("Ce lien est invalide ou a expiré. Demande une nouvelle invitation ou réinitialisation.");
      return;
    }
    if (!accessToken || !refreshToken || (type !== "invite" && type !== "recovery")) {
      setError("Aucun lien d'invitation ou de récupération valide n'a été détecté.");
      return;
    }
    setInvite({ accessToken, refreshToken, type });
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (newPassword.length < 12) {
      setError("Le mot de passe doit contenir au moins 12 caractères.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("La confirmation ne correspond pas au mot de passe.");
      return;
    }
    if (!invite) return;

    setPending(true);
    try {
      const response = await fetch("/api/auth/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: invite.accessToken,
          refresh_token: invite.refreshToken,
          type: invite.type,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        const errors: Record<string, string> = {
          lien_expire_ou_invalide: "Le lien a expiré ou n'est plus valide. Demande un nouveau lien.",
          role_admin_requis: "Ce compte n'a pas encore été autorisé sur VerifyCheck.",
          definition_mot_de_passe_impossible: "Supabase n'a pas accepté ce mot de passe. Vérifie la politique de mot de passe du projet.",
          champs_invalides: "Le lien ou les mots de passe fournis sont invalides.",
        };
        throw new Error(errors[body.error ?? ""] ?? "Impossible de finaliser le compte.");
      }
      setCompleted(true);
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de finaliser le compte.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className={styles.card} aria-label="Finaliser le compte VerifyCheck">
      <p className={styles.brand}>UCAO · VerifyCheck</p>
      <h1 className={styles.subtitle}>{invite?.type === "recovery" ? "Réinitialiser le mot de passe" : "Activer le compte"}</h1>
      {completed ? (
        <p role="status">Compte finalisé. Redirection vers le tableau de bord…</p>
      ) : invite ? (
        <>
          <p className={styles.footer}>Choisis un nouveau mot de passe d'au moins 12 caractères. Le lien n'est utilisable qu'une seule fois.</p>
          <label htmlFor="new-password" className={styles.label}>Nouveau mot de passe</label>
          <input id="new-password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={styles.input} />
          <label htmlFor="confirm-password" className={styles.label}>Confirmer le mot de passe</label>
          <input id="confirm-password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={styles.input} />
          {error && <p className={styles.error} role="alert">{error}</p>}
          <button type="submit" disabled={pending} className={styles.button}>{pending ? "Validation…" : "Définir le mot de passe"}</button>
        </>
      ) : (
        <>
          <p className={styles.error} role="alert">{error || "Vérification du lien…"}</p>
          <p className={styles.footer}>Retourne à la personne qui gère les comptes pour demander un nouveau lien.</p>
        </>
      )}
    </form>
  );
}
