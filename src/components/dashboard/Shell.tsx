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
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="9" y1="21" x2="9" y2="9" />
      </svg>
    ),
    absences: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    classes: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 21V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14" />
        <path d="M2 21h20M9 9h1m4 0h1M9 13h1m4 0h1M10 21v-4h4v4" />
      </svg>
    ),
    cours: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 4.5A2.5 2.5 0 0 1 5.5 2H21v17H5.5A2.5 2.5 0 0 0 3 21.5z" />
        <path d="M3 4.5v17M7 6h10M7 10h8" />
      </svg>
    ),
    eleves: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    cartes: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="10" height="16" rx="2" ry="2" />
        <rect x="14" y="4" width="7" height="16" rx="2" ry="2" />
        <line x1="3" y1="7" x2="14" y2="7" />
        <line x1="14" y1="17" x2="21" y2="17" />
      </svg>
    ),
    scolarite: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
    comptabilite: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="6" width="20" height="12" rx="2" ry="2" />
        <path d="M2 10h20M7 14h3m4 0h3" />
      </svg>
    ),
  };

  return <span className={styles.icon}>{svg[id]}</span>;
}

interface ShellProps {
  vue: Vue;
  onViewChange: (id: Vue) => void;
  children: React.ReactNode;
}

export default function Shell({ vue, onViewChange, children }: ShellProps) {
  const router = useRouter();
  // The desktop sidebar is always visible; this state only controls the
  // off-canvas navigation on narrow viewports.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toggleSidebar = useCallback(() => setSidebarOpen((open) => !open), []);

  const deconnexion = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } catch {
      // Redirection vers la connexion même si le réseau est momentanément indisponible.
    }
    router.replace("/login");
  }, [router]);

  const choisirVue = useCallback((id: Vue) => {
    onViewChange(id);
    setSidebarOpen(false);
  }, [onViewChange]);

  return (
    <div className={styles.shell}>
      <nav
        id="verifycheck-sidebar"
        className={`${styles.sidebar} ${sidebarOpen ? styles.open : ""}`}
        aria-label="Navigation principale"
      >
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
              type="button"
              className={`${styles.navItem} ${vue === v.id ? styles.active : ""}`}
              onClick={() => choisirVue(v.id)}
              aria-current={vue === v.id ? "page" : undefined}
            >
              <Icon id={v.id} />
              <span>{v.label}</span>
            </button>
          ))}
        </div>

        <div className={styles.sidebarFoot}>
          <div className={styles.schoolIdentity}>
            <span className={styles.schoolGlyph} aria-hidden="true">
              <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 9 9-6 9 6M5 10v9m4-9v9m6-9v9m4-9v9M3 21h18M2 10h20" />
              </svg>
            </span>
            <span className={styles.schoolCopy}>
              <strong>Établissement</strong>
              <small>Conakry, Guinée</small>
            </span>
          </div>
          <button
            type="button"
            className={styles.buttonOutline}
            onClick={deconnexion}
          >
            Se déconnecter
          </button>
        </div>
      </nav>

      <div className={styles.body}>
        {sidebarOpen ? (
          <button
            type="button"
            className={styles.backdrop}
            onClick={() => setSidebarOpen(false)}
            aria-label="Fermer le menu"
          />
        ) : null}

        <header className={styles.topbar}>
          <div className={styles.topbarInner}>
            <button
              type="button"
              className={styles.burger}
              aria-label={sidebarOpen ? "Fermer le menu" : "Ouvrir le menu"}
              aria-controls="verifycheck-sidebar"
              aria-expanded={sidebarOpen}
              onClick={toggleSidebar}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {sidebarOpen ? (
                  <path d="M18 6 6 18M6 6l12 12" />
                ) : (
                  <>
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </>
                )}
              </svg>
            </button>

            <div className={styles.topbarLeft}>
              <div className={styles.appName}>VerifyCheck <strong>· Direction</strong></div>
            </div>

            <div className={styles.topbarRight}>
              <div className={styles.account}>
                <span className={styles.avatar}>AD</span>
                <span>Admin</span>
                <span className={styles.accountChevron} aria-hidden="true">⌄</span>
              </div>
            </div>
          </div>
        </header>

        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
