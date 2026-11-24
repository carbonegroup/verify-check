import type { Metadata } from "next";
import Link from "next/link";
import pageStyles from "./page.module.css";

export const metadata: Metadata = {
  title: "VerifyCheck — Présence scolaire par QR code",
  description:
    "Suivi de présence scolaire par QR code : scan en salle et tableau de bord direction.",
};

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem",
    background: "var(--vc-bg)",
    color: "var(--vc-ink)",
  },
  card: {
    width: "min(520px, 92vw)",
    background: "var(--vc-surface)",
    border: "1px solid var(--vc-line)",
    borderRadius: "var(--vc-radius-lg)",
    padding: "2.5rem",
    boxShadow: "var(--vc-shadow)",
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  eyebrow: {
    margin: 0,
    color: "var(--vc-ink-soft)",
    fontSize: "0.8rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  title: {
    margin: 0,
    fontSize: "1.75rem",
    fontWeight: 700,
    color: "var(--vc-ink)",
    letterSpacing: "-0.01em",
  },
  lead: {
    margin: "0 0 1.25rem",
    color: "var(--vc-ink-soft)",
    lineHeight: 1.5,
    fontSize: "1rem",
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.75rem",
  },
  primary: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0.7rem 1.25rem",
    borderRadius: "var(--vc-radius-sm)",
    background: "var(--vc-primary)",
    color: "#fff",
    textDecoration: "none",
    fontWeight: 600,
    font: "inherit",
    fontSize: "1rem",
    border: "none",
    cursor: "pointer",
  },
  primaryHover: {
    background: "var(--vc-primary-hover)",
  },
};

export default function Home() {
  return (
    <main style={styles.main}>
      <div style={styles.card}>
        <p style={styles.eyebrow}>VerifyCheck · Présence scolaire</p>
        <h1 style={styles.title}>Présence scolaire par QR code</h1>
        <p style={styles.lead}>
          Les élèves pointent leur carte à l’entrée du cours ; la direction
          consulte la présence réelle par classe, cours et élève.
        </p>
        <div style={styles.actions}>
          <Link href="/login" className={pageStyles.primaryLink} style={styles.primary}>
            Espace direction
          </Link>
        </div>
      </div>
    </main>
  );
}
