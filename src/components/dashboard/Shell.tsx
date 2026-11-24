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
  { id: "general", label: "Vue générale" },
  { id: "absences", label: "Absences" },
  { id: "classes", label: "Classes" },
  { id: "cours", label: "Cours" },
  { id: "eleves", label: "Élèves" },
  { id: "cartes", label: "Cartes QR" },
  { id: "scolarite", label: "Scolarité" },
  { id: "comptabilite", label: "Comptabilité" },
];

function Icon({ id }: { id: Vue }) {
  const defs: Record<Vue, string> = {
    general: `<path d="M3 12l2-2m0 0l7-7 7 7M5 12v10a2 2 0 002 2h10a2 2 0 002-2v-6m2-6L6 20m0 0l8-8-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/>`,
    absences: `<path d="M18 10v8m0 0L8 14m4 4l4-4m4 4V10M12 10V4m0 6l4 4m-4 4L8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    classes: `<path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    cours: `<path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 10v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    eleves: `<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    cartes: `<rect x="2" y="3" width="20" height="14" rx="2" ry="2" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="8" y1="3" x2="8" y2="17" stroke="currentColor" stroke-width="1.5"/><line x1="12" y1="3" x2="12" y2="17" stroke="currentColor" stroke-width="1.5"/><line x1="16" y1="3" x2="16" y2="17" stroke="currentColor" stroke-width="1.5"/>`,
    scolarite: `<path d="M20 6h-2a2 2 0 00-2 2V10m0 0 3-3m-3 3l-3 3m7 3h-1M5 15h1m6 0h1m-6 0v-1m6 0v-1m-7 0v-1m6 2m-6 4h1m6 0h1m-6 0v-1m6 0v-1m-7 0v-1M5 19v-1m7-4h1m6 0h1m-6 0v-1m6 0v-1m-6-8h1m6 0h1m-6 0v-1m6 0v-1m-7 0v-1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    comptabilite: `<path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
  };
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" className={styles.icon} dangerouslySetInnerHTML={{ __html: defs[id] }} />
  );
}

interface ShellProps {
  vue: Vue;
  onViewChange: (id: Vue) => void;
  children: React.ReactNode;
}

export default function Shell({ vue, onViewChange, children }: ShellProps) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const toggleSidebar = useCallback(() => setSidebarOpen((o) => !o), []);

  const deconnexion = useCallback(async (event: React.MouseEvent) => {
    event.preventDefault();
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore : on redirige de toute façon vers la connexion */
    }
    router.replace("/login");
  }, [router]);

  return (
    <div className={styles.shell}>
      <nav className={`${styles.sidebar} ${sidebarOpen ? "" : styles.hidden}`} aria-label="Navigation principale">
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
              className={`${styles.navItem} ${vue === v.id ? styles.active : ""}`}
              onClick={() => onViewChange(v.id)}
              aria-current={vue === v.id ? "page" : undefined}
            >
              <Icon id={v.id} />
              {v.label}
            </button>
          ))}
        </div>
      </nav>

      <div className={styles.body}>
        <aside className={`${styles.backdrop} ${sidebarOpen ? styles.open : ""}`} onClick={toggleSidebar} aria-hidden="true" />

        <header className={styles.topbar}>
          <div className={styles.topbarInner}>
            <button className={styles.burger} aria-label="Menu" onClick={toggleSidebar} aria-expanded={sidebarOpen}>
              <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div className={styles.topbarLeft}>
              <div className={styles.appName}>VerifyCheck <strong>· Direction</strong></div>
            </div>
            <div className={styles.topbarRight}>
              <div className={styles.chip}>
                <span>Compte admin</span>
              </div>
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
