"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { buildAbsences, formatPresenceAt, STATUT_LABEL, statutEleve, type StatutPresence } from "@/lib/absences";
import { formatGnf } from "@/lib/scolarite";
import styles from "./Dashboard.module.css";
import Shell from "./Shell";

/**
 * Dashboard direction — données RÉELLES via GET /api/dashboard.
 * Distinction métier : présent (scan serveur) / non pointé (cours non terminé)
 * / absent (cours terminé sans scan). Jamais de mock en production.
 * Habillage Enterprise Light (docs/design-brief.md + direction visuelle retenue).
 */

const TIME_ZONE = "Africa/Conakry";

type Classe = { id: string; nom: string };
type Cours = {
  id: string;
  nom: string;
  classe_id: string;
  salle: string | null;
  heure_debut: string;
  heure_fin: string;
  jour_semaine: number;
};
type Eleve = {
  id: string;
  nom: string;
  code_qr: string;
  classe_id: string;
  photo_url?: string | null;
  scans: number;
  presences: Array<{ course_id: string; scanned_at: string }>;
};
type DashboardData = {
  date: string;
  jour_semaine: number;
  classes: Classe[];
  cours_prevus: Cours[];
  cours_semaine: Cours[];
  cours_disponibles: Cours[];
  effectif: number;
  presents: number;
  scans: number;
  eleves: Eleve[];
};

type Vue = "general" | "absences" | "classes" | "cours" | "eleves" | "cartes" | "scolarite" | "comptabilite";

const PAGE_META: Record<Vue, { title: string; description: string }> = {
  general: { title: "Vue générale", description: "Suivi des présences en temps réel" },
  absences: { title: "Absences", description: "Élèves absents dans les cours terminés" },
  classes: { title: "Classes", description: "Effectifs et activité par classe" },
  cours: { title: "Cours", description: "Planning et pointages des cours" },
  eleves: { title: "Élèves", description: "Suivi individuel des présences" },
  cartes: { title: "Cartes QR", description: "Cartes d’identification à imprimer" },
  scolarite: { title: "Scolarité", description: "Suivi des frais de scolarité" },
  comptabilite: { title: "Comptabilité", description: "Recettes, dépenses et soldes de l’établissement" },
};

type StatutFrais = "regle" | "partiel" | "impaye" | "sans-frais";
type ScolariteLigne = {
  eleve_id: string;
  eleve: string;
  classe_id: string;
  classe: string;
  photo_url?: string | null;
  attendu_gnf: number;
  regle_gnf: number;
  solde_gnf: number;
  statut: StatutFrais;
};
type ScolariteData = {
  lignes: ScolariteLigne[];
  par_classe: Array<{
    classe_id: string;
    classe: string;
    eleves: number;
    attendu_gnf: number;
    regle_gnf: number;
    solde_gnf: number;
    taux: number;
  }>;
  totaux: { eleves: number; attendu_gnf: number; regle_gnf: number; solde_gnf: number; taux: number };
};

type ComptabiliteEcriture = {
  id: string;
  date: string;
  type: "recette" | "depense";
  libelle: string;
  categorie: string | null;
  montant_gnf: number;
};
type ComptabiliteData = {
  ecritures: ComptabiliteEcriture[];
  par_categorie: Array<{ categorie: string; montant_gnf: number }>;
  totaux: { recettes_gnf: number; depenses_gnf: number; solde_gnf: number; nb_ecritures: number };
};

const STATUT_FRAIS_LABEL: Record<StatutFrais, string> = {
  regle: "RÉGLÉ",
  partiel: "PARTIEL",
  impaye: "IMPAYÉ",
  "sans-frais": "AUCUN FRAIS",
};

const CATEGORIE_LABEL: Record<string, string> = {
  salaires: "Salaires",
  fournitures: "Fournitures",
  entretien: "Entretien",
  transport: "Transport",
  energie: "Énergie",
  loyer: "Loyer",
  autre: "Autre",
};

const dateLabelFormatter = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: TIME_ZONE,
});

function todayConakry(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function nowMinutesConakry(): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}

/** Helper pour construire l'instant scolaire courant pour les fonctions de lib/absences. */
function nowConakry(): { jour: string; minutes: number } {
  return { jour: todayConakry(), minutes: nowMinutesConakry() };
}

function statutClass(statut: StatutPresence): string {
  const key = statut === "non-pointe" ? "nonPointe" : statut;
  return `${styles.pastille} ${key}`;
}

/** Réutilise les couleurs de pastille existantes pour les statuts de frais. */
const SCOLARITE_CLASS: Record<StatutFrais, string> = {
  regle: "present",
  partiel: "nonPointe",
  impaye: "absent",
  "sans-frais": "sansFrais",
};

function statutFraisClass(statut: StatutFrais): string {
  const key = SCOLARITE_CLASS[statut];
  return `${styles.pastille} ${key}`;
}

export default function DashboardClient() {
  const router = useRouter();
  const [vue, setVue] = useState<Vue>("general");
  const [date, setDate] = useState(todayConakry());
  const [classe, setClasse] = useState<string>("");
  const [cours, setCours] = useState<string>("");
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [classeNom, setClasseNom] = useState<string>("");

  const [statutScolarite, setStatutScolarite] = useState<"" | StatutFrais>("");
  const [scolarite, setScolarite] = useState<ScolariteData | null>(null);
  const [scolariteError, setScolariteError] = useState<string | null>(null);
  const [scolariteLoading, setScolariteLoading] = useState(false);
  const [periodeFrom, setPeriodeFrom] = useState<string>("");
  const [periodeTo, setPeriodeTo] = useState<string>("");
  const [comptabilite, setComptabilite] = useState<ComptabiliteData | null>(null);
  const [comptabiliteError, setComptabiliteError] = useState<string | null>(null);
  const [comptabiliteLoading, setComptabiliteLoading] = useState(false);

  // Connectivité faible : on mémorise en mémoire les réponses financières déjà
  // obtenues pour ne pas les retélécharger à chaque va-et-vient entre vues.
  const scolariteCache = useRef(new Map<string, ScolariteData>());
  const comptabiliteCache = useRef(new Map<string, ComptabiliteData>());
  const [scolariteReload, setScolariteReload] = useState(0);
  const [comptabiliteReload, setComptabiliteReload] = useState(0);

  const load = useCallback(async () => {
    const cancelledRef = { current: false };
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ date });
    if (classe) params.set("classe", classe);
    if (cours) params.set("cours", cours);
    try {
      const res = await fetch(`/api/dashboard?${params.toString()}`, { credentials: "same-origin" });
      if (res.status === 401) {
        router.push("/login?next=%2Fdashboard");
        return;
      }
      if (!res.ok) {
        if (!cancelledRef.current) setError(res.status === 400 ? "Date invalide." : "Erreur serveur — réessaie.");
        if (!cancelledRef.current) setData(null);
      } else {
        const body = (await res.json()) as DashboardData;
        if (!cancelledRef.current) setData(body);
        if (!cancelledRef.current) setClasseNom(
          classe ? (body.classes.find((c) => c.id === classe)?.nom ?? "") : ""
        );
      }
    } catch {
      if (!cancelledRef.current) setError("Réseau indisponible.");
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, [date, classe, cours, router]);

  useEffect(() => {
    const cancelledRef = { current: false };
    (async () => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ date });
      if (classe) params.set("classe", classe);
      if (cours) params.set("cours", cours);
      try {
        const res = await fetch(`/api/dashboard?${params.toString()}`, { credentials: "same-origin" });
        if (res.status === 401) {
          router.push("/login?next=%2Fdashboard");
          return;
        }
        if (!res.ok) {
          if (!cancelledRef.current) setError(res.status === 400 ? "Date invalide." : "Erreur serveur — réessaie.");
          if (!cancelledRef.current) setData(null);
        } else {
          const body = (await res.json()) as DashboardData;
          if (!cancelledRef.current) setData(body);
          if (!cancelledRef.current) setClasseNom(
            classe ? (body.classes.find((c) => c.id === classe)?.nom ?? "") : ""
          );
        }
      } catch {
        if (!cancelledRef.current) setError("Réseau indisponible.");
      } finally {
        if (!cancelledRef.current) setLoading(false);
      }
    })();
    return () => {
      cancelledRef.current = true;
    };
  }, [date, classe, cours, router]);

  // Service scolarité : chargé à la demande (vue Scolarité), avec cache mémoire.
  useEffect(() => {
    if (vue !== "scolarite") return;
    const key = `${classe}|${statutScolarite}`;
    const cached = scolariteCache.current.get(key);
    if (cached) {
      setScolarite(cached);
      setScolariteError(null);
      setScolariteLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setScolariteLoading(true);
      setScolariteError(null);
      const params = new URLSearchParams();
      if (classe) params.set("classe", classe);
      if (statutScolarite) params.set("statut", statutScolarite);
      try {
        const res = await fetch(`/api/scolarite?${params.toString()}`, { credentials: "same-origin" });
        if (res.status === 401) {
          router.push("/login?next=%2Fdashboard");
          return;
        }
        if (!res.ok) {
          setScolariteError("Erreur serveur — réessaie.");
          setScolarite(null);
        } else {
          const body = (await res.json()) as ScolariteData;
          scolariteCache.current.set(key, body);
          setScolarite(body);
        }
      } catch {
        setScolariteError("Réseau indisponible.");
      } finally {
        if (!cancelled) setScolariteLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vue, classe, statutScolarite, scolariteReload, router]);

  // Service comptabilité : chargé à la demande (vue Comptabilité), avec cache mémoire.
  useEffect(() => {
    if (vue !== "comptabilite") return;
    const key = `${periodeFrom}|${periodeTo}`;
    const cached = comptabiliteCache.current.get(key);
    if (cached) {
      setComptabilite(cached);
      setComptabiliteError(null);
      setComptabiliteLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setComptabiliteLoading(true);
      setComptabiliteError(null);
      const params = new URLSearchParams();
      if (periodeFrom) params.set("from", periodeFrom);
      if (periodeTo) params.set("to", periodeTo);
      try {
        const res = await fetch(`/api/comptabilite?${params.toString()}`, { credentials: "same-origin" });
        if (res.status === 401) {
          router.push("/login?next=%2Fdashboard");
          return;
        }
        if (!res.ok) {
          setComptabiliteError("Erreur serveur — réessaie.");
          setComptabilite(null);
        } else {
          const body = (await res.json()) as ComptabiliteData;
          comptabiliteCache.current.set(key, body);
          setComptabilite(body);
        }
      } catch {
        setComptabiliteError("Réseau indisponible.");
      } finally {
        if (!cancelled) setComptabiliteLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vue, periodeFrom, periodeTo, comptabiliteReload, router]);

  // « Réessayer » : invalide le cache de la vue concernée et relance la requête.
  const retryScolarite = useCallback(() => {
    scolariteCache.current.delete(`${classe}|${statutScolarite}`);
    setScolariteReload((n) => n + 1);
  }, [classe, statutScolarite]);

  const retryComptabilite = useCallback(() => {
    comptabiliteCache.current.delete(`${periodeFrom}|${periodeTo}`);
    setComptabiliteReload((n) => n + 1);
  }, [periodeFrom, periodeTo]);

  const exportUrl = useMemo(() => {
    const params = new URLSearchParams({ date });
    if (classe) params.set("classe", classe);
    if (cours) params.set("cours", cours);
    return `/api/dashboard/export?${params.toString()}`;
  }, [date, classe, cours]);

  const scolariteExportUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (classe) params.set("classe", classe);
    if (statutScolarite) params.set("statut", statutScolarite);
    const q = params.toString();
    return `/api/scolarite/export${q ? `?${q}` : ""}`;
  }, [classe, statutScolarite]);

  const comptabiliteExportUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (periodeFrom) params.set("from", periodeFrom);
    if (periodeTo) params.set("to", periodeTo);
    const q = params.toString();
    return `/api/comptabilite/export${q ? `?${q}` : ""}`;
  }, [periodeFrom, periodeTo]);

  const classeLabel = (id: string) => data?.classes.find((c) => c.id === id)?.nom ?? "—";
  const eleveParClasse = useMemo(
    () => (data?.eleves ?? []).filter((e) => !classe || e.classe_id === classe),
    [data, classe]
  );
  // Liste des absences : même règle que l'export CSV (cours terminé sans scan).
  const absences = useMemo(
    () =>
      data
        ? buildAbsences(
            { classes: data.classes, cours: data.cours_prevus, eleves: data.eleves },
            { date, now: { jour: todayConakry(), minutes: nowMinutesConakry() } }
          )
        : [],
    [data, date]
  );
  const dateLabel = dateLabelFormatter.format(new Date(`${date}T12:00:00Z`));

  const changementVue = useCallback((id: Vue) => {
    setVue(id);
    // Réinitialise le filtrage par cours quand on change de vue (évite un cours
    // filtré mais masqué qui rendrait la vue confuse).
    setCours("");
  }, []);

  return (
    <Shell vue={vue} onViewChange={changementVue}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{PAGE_META[vue].title}</h1>
          <p className={styles.pageDescription}>
            {vue === "general" ? PAGE_META[vue].description : `${PAGE_META[vue].description} · ${dateLabel}`}
          </p>
        </div>
      </header>

      {/* Filtres persistants : date, classe et cours restent synchronisés avec l'API. */}
      {data && !loading && (
        <div className={styles.filters}>
          <label>
            <span>Date</span>
            <input
              type="date"
              value={date}
              max={todayConakry()}
              onChange={(e) => setDate(e.target.value)}
              aria-label="Date du suivi"
            />
          </label>
          <label>
            <span>Classe</span>
            <select
              value={classe}
              onChange={(e) => { setClasse(e.target.value); setCours(""); }}
              aria-label="Filtrer par classe"
            >
              <option value="">Toutes les classes</option>
              {data.classes.map((c) => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Cours</span>
            <select
              value={cours}
              onChange={(e) => setCours(e.target.value)}
              aria-label="Filtrer par cours"
            >
              <option value="">Tous les cours</option>
              {data.cours_disponibles.map((c) => (
                <option key={c.id} value={c.id}>
                  {["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"][c.jour_semaine]} · {c.nom} · {c.heure_debut.slice(0, 5)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={styles.button}
            onClick={() => void load()}
            disabled={loading}
          >
            Actualiser
          </button>
        </div>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
          <button type="button" className={styles.buttonSmall} onClick={() => void load()}>
            Réessayer
          </button>
        </p>
      )}
      {loading && <p className={styles.loading}>Chargement des données réelles…</p>}

      {data && !loading && (
        <div className={styles.content}>
          {/* ---------------------------------------------- VUE GÉNÉRALE */}
          {vue === "general" && (
            <>
              <section className={styles.metricGrid} aria-label="Indicateurs de présence">
                <article className={`${styles.metricCard} ${styles.metricEffectif}`}>
                  <span className={styles.metricIcon} aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </span>
                  <div className={styles.metricBody}>
                    <span className={styles.metricLabel}>Effectif</span>
                    <strong className={styles.kpi}>{data.effectif}</strong>
                    <span className={styles.metricDetail}>élèves inscrits</span>
                  </div>
                </article>

                <article className={`${styles.metricCard} ${styles.metricPresence}`}>
                  <span className={styles.metricIcon} aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m5 12 4 4L19 6" />
                      <circle cx="12" cy="12" r="10" />
                    </svg>
                  </span>
                  <div className={styles.metricBody}>
                    <span className={styles.metricLabel}>Présents</span>
                    <strong className={styles.kpi}>{data.presents}</strong>
                    <span className={styles.metricDetail}>
                      {data.effectif > 0 ? `${((data.presents / data.effectif) * 100).toFixed(1)} % de l’effectif` : "Aucun élève inscrit"}
                    </span>
                  </div>
                </article>

                <article className={`${styles.metricCard} ${styles.metricScans}`}>
                  <span className={styles.metricIcon} aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7" />
                      <rect x="14" y="3" width="7" height="7" />
                      <rect x="3" y="14" width="7" height="7" />
                      <path d="M14 14h3v3h-3zM20 14v2m-3 3h2m2 0v2m-7-1v1" />
                    </svg>
                  </span>
                  <div className={styles.metricBody}>
                    <span className={styles.metricLabel}>Scans</span>
                    <strong className={styles.kpi}>{data.scans}</strong>
                    <span className={styles.metricDetail}>aujourd’hui</span>
                  </div>
                </article>

                <article className={`${styles.metricCard} ${styles.metricCourses}`}>
                  <span className={styles.metricIcon} aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="17" rx="2" />
                      <path d="M16 2v4M8 2v4M3 10h18" />
                      <path d="M8 14h2m4 0h2m-8 3h2" />
                    </svg>
                  </span>
                  <div className={styles.metricBody}>
                    <span className={styles.metricLabel}>Cours prévus</span>
                    <strong className={styles.kpi}>{data.cours_prevus.length}</strong>
                    <span className={styles.metricDetail}>ce jour</span>
                  </div>
                </article>
              </section>

              <section className={styles.tablePanel} aria-labelledby="attendance-register-title">
                <div className={styles.tablePanelHeader}>
                  <h2 id="attendance-register-title" className={styles.tablePanelTitle}>
                    Registre de présence
                  </h2>
                  <a className={styles.buttonOutline} href={exportUrl}>
                    Exporter CSV
                  </a>
                </div>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Classe</th>
                        <th>Cours</th>
                        <th>Salle</th>
                        <th>Horaire</th>
                        <th>Présents</th>
                        <th>Absents</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.cours_prevus.map((c) => {
                        const eleves = eleveParClasse.filter((e) => e.classe_id === c.classe_id);
                        const statuts = eleves.map((e) => statutEleve(e, c, date, nowConakry()));
                        const presents = statuts.filter((s) => s === "present").length;
                        const absents = statuts.filter((s) => s === "absent").length;
                        return (
                          <tr key={c.id}>
                            <td>{classeLabel(c.classe_id)}</td>
                            <td className={styles.courseCell}>{c.nom}</td>
                            <td>{c.salle ?? "—"}</td>
                            <td className={styles.num}>
                              {c.heure_debut.slice(0, 5)}–{c.heure_fin.slice(0, 5)}
                            </td>
                            <td>
                              <span className={`${styles.statePill} ${styles.statePresent}`}>
                                Présent ({presents})
                              </span>
                            </td>
                            <td>
                              <span className={`${styles.statePill} ${styles.stateAbsent}`}>
                                Absent ({absents})
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {data.cours_prevus.length === 0 && (
                        <tr>
                          <td colSpan={6} className={styles.empty}>
                            Aucun cours prévu pour ces filtres.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <div className={styles.actionsRow}>
                <button className={styles.buttonOutline} onClick={() => window.print()}>
                  Imprimer le registre
                </button>
              </div>
            </>
          )}

          {/* ----------------------------------------------- ABSENCES */}
          {vue === "absences" && (
            <>
              <div className={styles.actionsRow}>
                <a className={styles.button} href={exportUrl}>
                  Exporter en CSV
                </a>
                <button className={styles.buttonOutline} onClick={() => window.print()}>
                  Imprimer la liste
                </button>
              </div>

              <h2 className={styles.printTitle}>
                Liste des absences — {dateLabel}
                {classeNom ? ` · ${classeNom}` : ""}
              </h2>
              <p className={styles.summaryLine}>
                <strong>{absences.length}</strong> absence{absences.length > 1 ? "s" : ""} ·{" "}
                {data.cours_prevus.length} cours prévu{data.cours_prevus.length > 1 ? "s" : ""} ·
                cours terminé sans scan
              </p>

              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Élève</th>
                    <th>Classe</th>
                    <th>Cours</th>
                    <th>Horaire</th>
                    <th>Salle</th>
                  </tr>
                </thead>
                <tbody>
                  {absences.map((a) => (
                    <tr key={`${a.eleve_id}|${a.cours_id}`}>
                      <td>{a.eleve}</td>
                      <td>{a.classe}</td>
                      <td>{a.cours}</td>
                      <td className={styles.num}>
                        {a.heure_debut.slice(0, 5)}
                        {a.heure_fin ? `–${a.heure_fin.slice(0, 5)}` : ""}
                      </td>
                      <td>{a.salle ?? "—"}</td>
                    </tr>
                  ))}
                  {absences.length === 0 && (
                    <tr>
                      <td colSpan={5} className={styles.empty}>
                        Aucune absence déclarée pour ces filtres.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </>
          )}

          {/* ------------------------------------------------ CLASSES */}
          {vue === "classes" && (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Classe</th>
                  <th>Élèves</th>
                  <th>Présents aujourd’hui</th>
                  <th>Cours prévus</th>
                </tr>
              </thead>
              <tbody>
                {data.classes.map((c) => {
                  const eleves = data.eleves.filter((e) => e.classe_id === c.id);
                  const coursClasse = data.cours_prevus.filter((k) => k.classe_id === c.id);
                  const presents = eleves.filter((e) =>
                    coursClasse.some((k) => e.presences.some((p) => p.course_id === k.id))
                  ).length;
                  return (
                    <tr key={c.id}>
                      <td>{c.nom}</td>
                      <td className={styles.num}>{eleves.length}</td>
                      <td className={styles.num}>{presents}</td>
                      <td className={styles.num}>{coursClasse.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* -------------------------------------------------- COURS */}
          {vue === "cours" && (
            <>
              <p className={styles.summaryLine}>
                Planning hebdomadaire · {data.cours_semaine.length} cours
                {classeNom ? " · " + classeNom : ""}
              </p>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Jour</th>
                    <th>Cours</th>
                    <th>Classe</th>
                    <th>Heure</th>
                    <th>Salle</th>
                    <th>Présents le {dateLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.cours_semaine.map((c) => {
                    const eleves = data.eleves.filter((e) => e.classe_id === c.classe_id);
                    const presents = eleves.filter((e) => e.presences.some((p) => p.course_id === c.id));
                    const isSelectedDay = c.jour_semaine === data.jour_semaine;
                    return (
                      <tr key={c.id}>
                        <td>{["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"][c.jour_semaine]}</td>
                        <td>{c.nom}</td>
                        <td>{classeLabel(c.classe_id)}</td>
                        <td className={styles.num}>
                          {c.heure_debut.slice(0, 5)}–{c.heure_fin.slice(0, 5)}
                        </td>
                        <td>{c.salle ?? "—"}</td>
                        <td className={styles.num}>{isSelectedDay ? presents.length + "/" + eleves.length : "—"}</td>
                      </tr>
                    );
                  })}
                  {data.cours_semaine.length === 0 && (
                    <tr>
                      <td colSpan={6} className={styles.empty}>
                        Aucun cours programmé pour ces filtres.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </>
          )}

          {/* -------------------------------------------------- ÉLÈVES */}
          {vue === "eleves" && (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Élève</th>
                  <th>Classe</th>
                  <th>Code carte</th>
                  <th>Scans</th>
                  <th>Historique</th>
                </tr>
              </thead>
              <tbody>
                {eleveParClasse.map((e) => {
                  const history = data.cours_prevus
                    .filter((c) => c.classe_id === e.classe_id)
                    .map((c) => ({
                      cours: c,
                      statut: statutEleve(e, c, date, nowConakry()),
                      presence: e.presences.find((p) => p.course_id === c.id),
                    }));
                  // Build Supabase Storage public URL if photo_url exists
                  const photoUrl = e.photo_url
                    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${e.photo_url}`
                    : null;
                  return (
                    <tr key={e.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div className={styles.studentAvatar}>
                            {photoUrl ? (
                              <img
                                src={photoUrl}
                                alt={`${e.nom}`}
                                className={styles.studentAvatarImage}
                                onLoad={(ev) => { ev.currentTarget.classList.add(styles.loaded); }}
                                onError={(ev) => { ev.currentTarget.style.display = 'none'; }}
                              />
                            ) : null}
                            <div className={styles.studentAvatarFallback}>
                              {e.nom.charAt(0).toUpperCase()}
                            </div>
                          </div>
                          <span>{e.nom}</span>
                        </div>
                      </td>
                      <td>{classeLabel(e.classe_id)}</td>
                      <td className={styles.code}>{e.code_qr}</td>
                      <td className={styles.num}>{e.scans}</td>
                      <td>
                        {history.length === 0 ? (
                          <span className={styles.empty}>Aucun cours prévu.</span>
                        ) : (
                          history.map(({ cours: c, statut, presence }) => (
                            <span key={`${e.id}-${c.id}`} className={statutClass(statut)}>
                              {c.nom}
                              {presence
                                ? ` · Présent · ${formatPresenceAt(presence.scanned_at)}`
                                : ` · ${STATUT_LABEL[statut]}`}
                            </span>
                          ))
                        )}
                      </td>
                    </tr>
                  );
                })}
                {eleveParClasse.length === 0 && (
                  <tr>
                    <td colSpan={5} className={styles.empty}>
                      Aucun élève pour ce filtre.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {/* -------------------------------------------------- CARTES */}
          {vue === "cartes" && (
            <CartesQR eleves={eleveParClasse} classeLabel={classeLabel} classeNom={classeNom} />
          )}

          {/* ---------------------------------------------- SCOLARITÉ */}
          {vue === "scolarite" && (
            <>
              <div className={styles.actionsRow}>
                <div className={styles.inlineFilter}>
                  <span>Statut</span>
                  <select
                    value={statutScolarite}
                    onChange={(e) => setStatutScolarite(e.target.value as "" | StatutFrais)}
                  >
                    <option value="">Tous</option>
                    <option value="impaye">Impayés</option>
                    <option value="partiel">Partiels</option>
                    <option value="regle">Réglés</option>
                    <option value="sans-frais">Sans frais</option>
                  </select>
                </div>
                <a className={styles.button} href={scolariteExportUrl}>
                  Exporter en CSV
                </a>
                <button className={styles.buttonOutline} onClick={() => window.print()}>
                  Imprimer
                </button>
              </div>

              {scolariteError && (
                <p className={styles.error} role="alert">
                  {scolariteError}
                  <button type="button" className={styles.buttonSmall} onClick={retryScolarite}>
                    Réessayer
                  </button>
                </p>
              )}
              {scolariteLoading && <p className={styles.loading}>Chargement de la scolarité…</p>}

              {scolarite && !scolariteLoading && (
                <>
                  <section className={styles.resume}>
                    <div>
                      <span className={styles.kpi}>{formatGnf(scolarite.totaux.attendu_gnf)}</span>
                      <span className={styles.kpiLabel}>attendu</span>
                    </div>
                    <div>
                      <span className={styles.kpi}>{formatGnf(scolarite.totaux.regle_gnf)}</span>
                      <span className={styles.kpiLabel}>réglé</span>
                    </div>
                    <div>
                      <span className={styles.kpi}>{formatGnf(scolarite.totaux.solde_gnf)}</span>
                      <span className={styles.kpiLabel}>solde dû</span>
                    </div>
                    <div>
                      <span className={styles.kpi}>{Math.round(scolarite.totaux.taux * 100)} %</span>
                      <span className={styles.kpiLabel}>recouvrement</span>
                    </div>
                  </section>

                  <h2 className={styles.printTitle}>
                    Frais de scolarité{classeNom ? ` — ${classeNom}` : ""}
                  </h2>

                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Élève</th>
                        <th>Classe</th>
                        <th>Attendu</th>
                        <th>Réglé</th>
                        <th>Solde</th>
                        <th>Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scolarite.lignes.map((l) => {
                        // Build Supabase Storage public URL if photo_url exists
                        const photoUrl = l.photo_url
                          ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${l.photo_url}`
                          : null;
                        return (
                          <tr key={l.eleve_id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div className={styles.studentAvatar}>
                                  {photoUrl ? (
                                    <img
                                      src={photoUrl}
                                      alt={`${l.eleve}`}
                                      className={styles.studentAvatarImage}
                                      onLoad={(ev) => { ev.currentTarget.classList.add(styles.loaded); }}
                                      onError={(ev) => { ev.currentTarget.style.display = 'none'; }}
                                    />
                                  ) : null}
                                  <div className={styles.studentAvatarFallback}>
                                    {l.eleve.charAt(0).toUpperCase()}
                                  </div>
                                </div>
                                <span>{l.eleve}</span>
                              </div>
                            </td>
                            <td>{l.classe}</td>
                            <td className={styles.num}>{formatGnf(l.attendu_gnf)}</td>
                            <td className={styles.num}>{formatGnf(l.regle_gnf)}</td>
                            <td className={styles.num}>{formatGnf(l.solde_gnf)}</td>
                            <td>
                              <span className={statutFraisClass(l.statut)}>
                                {STATUT_FRAIS_LABEL[l.statut]}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {scolarite.lignes.length === 0 && (
                        <tr>
                          <td colSpan={6} className={styles.empty}>
                            Aucun élève pour ces filtres.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </>
              )}
            </>
          )}

          {/* ------------------------------------------- COMPTABILITÉ */}
          {vue === "comptabilite" && (
            <>
              <div className={styles.actionsRow}>
                <div className={styles.inlineFilter}>
                  <span>Du</span>
                  <input
                    type="date"
                    value={periodeFrom}
                    max={periodeTo || undefined}
                    onChange={(e) => setPeriodeFrom(e.target.value)}
                  />
                </div>
                <div className={styles.inlineFilter}>
                  <span>Au</span>
                  <input
                    type="date"
                    value={periodeTo}
                    min={periodeFrom || undefined}
                    onChange={(e) => setPeriodeTo(e.target.value)}
                  />
                </div>
                <a className={styles.button} href={comptabiliteExportUrl}>
                  Exporter en CSV
                </a>
                <button className={styles.buttonOutline} onClick={() => window.print()}>
                  Imprimer
                </button>
              </div>

              {comptabiliteError && (
                <p className={styles.error} role="alert">
                  {comptabiliteError}
                  <button type="button" className={styles.buttonSmall} onClick={retryComptabilite}>
                    Réessayer
                  </button>
                </p>
              )}
              {comptabiliteLoading && <p className={styles.loading}>Chargement de la comptabilité…</p>}

              {comptabilite && !comptabiliteLoading && (
                <>
                  <section className={styles.resume}>
                    <div>
                      <span className={styles.kpi}>{formatGnf(comptabilite.totaux.recettes_gnf)}</span>
                      <span className={styles.kpiLabel}>recettes</span>
                    </div>
                    <div>
                      <span className={styles.kpi}>{formatGnf(comptabilite.totaux.depenses_gnf)}</span>
                      <span className={styles.kpiLabel}>dépenses</span>
                    </div>
                    <div>
                      <span className={styles.kpi}>{formatGnf(comptabilite.totaux.solde_gnf)}</span>
                      <span className={styles.kpiLabel}>solde</span>
                    </div>
                    <div>
                      <span className={styles.kpi}>{comptabilite.totaux.nb_ecritures}</span>
                      <span className={styles.kpiLabel}>écritures</span>
                    </div>
                  </section>

                  <h2 className={styles.printTitle}>
                    Grand livre{periodeFrom || periodeTo
                      ? ` — ${periodeFrom || "début"} → ${periodeTo || "aujourd’hui"}`
                      : ""
                    }
                  </h2>

                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Libellé</th>
                        <th>Catégorie</th>
                        <th>Montant</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comptabilite.ecritures.map((e) => (
                        <tr key={e.id}>
                          <td className={styles.num}>{e.date}</td>
                          <td>{e.type === "recette" ? "Recette" : "Dépense"}</td>
                          <td>{e.libelle}</td>
                          <td>{e.categorie ? (CATEGORIE_LABEL[e.categorie] ?? e.categorie) : "—"}</td>
                          <td className={styles.num}>{formatGnf(e.montant_gnf)}</td>
                        </tr>
                      ))}
                      {comptabilite.ecritures.length === 0 && (
                        <tr>
                          <td colSpan={5} className={styles.empty}>
                            Aucune écriture pour cette période.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {comptabilite.par_categorie.length > 0 && (
                    <>
                      <h2 className={styles.printTitle}>Dépenses par catégorie</h2>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Catégorie</th>
                            <th>Montant</th>
                          </tr>
                        </thead>
                        <tbody>
                          {comptabilite.par_categorie.map((c) => (
                            <tr key={c.categorie}>
                              <td>{CATEGORIE_LABEL[c.categorie] ?? c.categorie}</td>
                              <td className={styles.num}>{formatGnf(c.montant_gnf)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </Shell>
  );
}

/* ------------------------------------------------------------ Cartes QR */

function CartesQR({
  eleves,
  classeLabel,
  classeNom,
}: {
  eleves: Eleve[];
  classeLabel: (id: string) => string;
  classeNom: string;
}) {
  // QR générés côté serveur (`GET /api/cartes/qr`, lib `qrcode` hors bundle client).
  // Même origine : les cookies de session admin accompagnent les images.
  return (
    <section>
      <p className={styles.actionsRow}>
        <button className={styles.buttonOutline} onClick={() => window.print()}>
          Imprimer la planche ({eleves.length} cartes)
        </button>
      </p>
      <h2 className={styles.printTitle}>
        {classeNom ? `Cartes — ${classeNom}` : "Cartes — toutes les classes"}
      </h2>
      <div className={styles.cards}>
        {eleves.map((e) => {
          // Build Supabase Storage public URL if photo_url exists
          const photoUrl = e.photo_url
            ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${e.photo_url}`
            : null;
          return (
            <article key={e.id} className={styles.card}>
              <div className={styles.cardHead}>
                <span className={styles.cardBrand}>VerifyCheck</span>
                <span className={styles.cardClasse}>{classeLabel(e.classe_id)}</span>
              </div>
              <div className={styles.cardBody}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <div className={`${styles.studentAvatar} ${styles.studentAvatarLarge}`}>
                    {photoUrl ? (
                      <img
                        src={photoUrl}
                        alt={`${e.nom}`}
                        className={styles.studentAvatarImage}
                        onLoad={(ev) => { ev.currentTarget.classList.add(styles.loaded); }}
                        onError={(ev) => { ev.currentTarget.style.display = 'none'; }}
                      />
                    ) : null}
                    <div className={styles.studentAvatarFallback}>
                      {e.nom.charAt(0).toUpperCase()}
                    </div>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/cartes/qr?code=${encodeURIComponent(e.code_qr)}`}
                    alt={`QR de ${e.nom}`}
                    width={110}
                    height={110}
                  />
                </div>
                <div style={{ textAlign: 'center', marginTop: '8px' }}>
                  <div className={styles.cardNom}>{e.nom}</div>
                  <div className={styles.cardCode}>{e.code_qr}</div>
                </div>
              </div>
            </article>
          );
        })}
        {eleves.length === 0 && <p className={styles.empty}>Aucun élève pour ce filtre.</p>}
      </div>
    </section>
  );
}
