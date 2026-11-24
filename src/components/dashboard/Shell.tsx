"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import styles from "./Shell.module.css";

type Vue =
  | "general"
  | "absences"
  | "classes"
  | "cours"
  | "eleves"
  | "cartes"
  | "scolarite"
  | "comptabilite";

const VUES: { id: Vue; label: string }[] = [
  { id: "general", label: "Générale" },
  { id: "absences", label: "Absences" },
  { id: "classes", label: "Classes" },
  { id: "cours", label: "Cours" },
  { id: "eleves", label: "Élèves" },
  { id: "cartes", label: "Cartes" },
  { id: "scolarite", label: "Scolarité" },
  { id: "comptabilite", label: "Comptabilité" },
];

function Icon({ id }: { id: Vue }) {
  const svg: Record<Vue, JSX.Element> = {
    general: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="9" y1="21" x2="9" y2="9" />
      </svg>
    ),
    absences: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    classes: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 4c-1 1-1 1-1 2l-1 5c-1 1-2 3-3 3h-8c-1 0-2-1-2-2V8c0-1-1-2-2-2H6c-1 0-1 1-1 1 0 1-1 1-1 2v13c0 1 1 2 2 2h12c1 0 2-1 2-2V4c0-1 1-1 1-1" />
      </svg>
    ),
    cours: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6l4 8v5a2 2 0 0 0 2 2h5a2 2 0 0 0 2-2v-5z" />
        <line x1="6" y1="2" x2="6" y2="4" />
        <line x1="10" y1="2" x2="10" y2="4" />
        <line x1="16" y1="2" x2="16" y2="4" />
        <line x1="20" y1="2" x2="20" y2="4" />
      </svg>
    ),
    eleves: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    cartes: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="10" height="16" rx="2" ry="2" />
        <rect x="14" y="4" width="7" height="16" rx="2" ry="2" />
        <line x1="3" y1="7" x2="14" y2="7" />
        <line x1="14" y1="17" x2="21" y2="17" />
      </svg>
    ),
    scolarite: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
    comptabilite: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="12" rx="2" ry="2" />
        <polyline points="16 14 20 8 12 14 6 6" />
        <line x1="16" y1="14" x2="18" y2="14" />
        <line x1="12" y1="14" x2="14" y2="14" />
      </svg>
    ),
  };
  return <span className={styles.icon}>{svg[id]}</span>;
}

export default function Shell({ vue, onViewChange, children }: { vue: Vue; onViewChange: (id: Vue) => void; children: React.ReactNode }) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const toggleSidebar = useCallback(() => setSidebarOpen((o) => !o), []);

  const deconnexion = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } catch {
      // Idempotent : même si l'appel échoue, on nettoie côté client.
    }
    router.replace("/login");
  }, [router]);

  return (
    <div className={`${styles.shell} ${sidebarOpen ? "" : styles.hidden}`}>
      <nav className={styles.sidebar} aria-label="Navigation principale">
        <div className={styles.sidebarHead}>
          <span className={styles.logoMark}>VC</span>
          <div>
            <div className={styles.logoText}>VerifyCheck</div>
            <div className={styles.logoSub}>Direction d’établissement</div>
          </div>
        </div>
        <div className={styles.nav}>
          {VUES.map((v) => (
            <button
              key={v.id}
              className={`navItem ${vue === v.id ? styles.active : ""}`}
              onClick={() => onViewChange(v.id)}
              aria-current={vue === v.id ? "page" : undefined}
            >
              <Icon id={v.id} />
              {v.label}
            </button>
          ))}
        </div>
        <div className={styles.sidebarFoot}>
          <button
            className={styles.buttonOutline}
            onClick={deconnexion}
            aria-label="Déconnexion"
          >
            Déconnexion
          </button>
        </div>
      </nav>

      <div className={styles.body}>
        <aside
          className={`${styles.backdrop} ${sidebarOpen ? styles.open : ""}`}
          onClick={toggleSidebar}
          aria-hidden="true"
        />

        <header className={styles.topbar}>
          <div className={styles.topbarInner}>
            <button className={styles.burger} aria-label="Menu" onClick={toggleSidebar} aria-expanded={sidebarOpen}>
              <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div className={styles.topbarLeft}>
              <div className={styles.appName}>VerifyCheck <strong>· Direction</strong></div>
            </div>
            <div className={styles.topbarRight}>
              <div className={styles.chip}>Compte admin</div>
              <button className={styles.buttonOutline} onClick={deconnexion}>
                Déconnexion
              </button>
            </div>
          </div>
        </header>

        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
