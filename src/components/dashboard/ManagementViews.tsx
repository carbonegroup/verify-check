"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./Management.module.css";

type ClassOption = { id: string; nom: string; is_demo?: boolean };
type SharedProps = {
  demoMode: boolean;
  classes: ClassOption[];
  onChanged?: () => void;
};
type Student = {
  id: string; nom: string; prenom: string | null; code_qr: string; classe_id: string;
  email?: string | null; telephone?: string | null; archived_at?: string | null;
  is_demo?: boolean; photo_url?: string | null;
};
type Course = {
  id: string; nom: string; classe_id: string; salle: string | null; enseignant?: string | null;
  jour_semaine: number; heure_debut: string; heure_fin: string; archived_at?: string | null;
  is_demo?: boolean;
};
type ApiError = { error?: string; errors?: Array<{ row: number; error: string }> };

async function responseJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (body as ApiError).error ?? `http_${response.status}`;
    throw new Error(message);
  }
  return body as T;
}

function errorLabel(value: string): string {
  const labels: Record<string, string> = {
    erreur_base: "La base de données n'a pas répondu correctement.",
    erreur_comptes: "Impossible de charger les comptes.",
    erreur_base_indisponible: "La vérification des données a échoué.",
    classe_invalide: "La classe sélectionnée est absente, archivée ou incompatible.",
    contexte_academique_invalide: "L'élève et le cours ne correspondent pas à la même classe.",
    matricule_duplique: "Ce matricule existe déjà.",
    matricule_deja_existant: "Un matricule du fichier existe déjà dans la base.",
    presence_deja_enregistree: "Une présence existe déjà pour cet élève et ce cours.",
    statut_et_justification_requis: "Le statut et une justification sont obligatoires.",
    verification_conflits_indisponible: "La vérification des conflits est indisponible.",
    configuration_admin_indisponible: "La clé d'administration Supabase n'est pas configurée côté serveur.",
    dernier_dev_protege: "Impossible de désactiver ou rétrograder le dernier compte DEV actif.",
    modification_propre_compte_interdite: "Tu ne peux pas désactiver ou rétrograder ton propre compte.",
    role_dev_requis: "Cette opération est réservée au rôle DEV.",
    invitation_impossible: "Invitation impossible. Vérifie l'adresse et la configuration e-mail.",
    compte_existant: "Un compte existe déjà pour cette adresse.",
    import_refuse: "Import annulé : corrige les lignes signalées avant de recommencer.",
    cours_introuvable: "Le cours demandé n'existe plus.",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

function parseDelimited(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const separator = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') {
      field += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === separator && !quoted) {
      row.push(field.trim());
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field.trim());
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  row.push(field.trim());
  if (row.some((cell) => cell !== "")) rows.push(row);
  return rows;
}

const DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

export function StudentsManager({ demoMode, classes, onChanged }: SharedProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [archived, setArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState({ nom: "", prenom: "", code_qr: "", classe_id: "", email: "", telephone: "" });
  const [busy, setBusy] = useState(false);
  const [csvPreview, setCsvPreview] = useState<Array<{ row: number; data: Record<string, string>; error: string }>>([]);
  const [csvFileName, setCsvFileName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), perPage: "50" });
      if (q.trim()) params.set("q", q.trim());
      if (archived) params.set("archived", "1");
      if (demoMode) params.set("demo", "1");
      const result = await responseJson<{ students: Student[]; total: number }>(
        await fetch(`/api/students?${params.toString()}`, { credentials: "same-origin" })
      );
      setStudents(result.students);
      setTotal(result.total);
    } catch (err) {
      setError(errorLabel(err instanceof Error ? err.message : "erreur_inconnue"));
    } finally {
      setLoading(false);
    }
  }, [page, q, archived, demoMode]);

  useEffect(() => { void load(); }, [load]);

  const resetForm = () => {
    setEditingId("");
    setForm({ nom: "", prenom: "", code_qr: "", classe_id: "", email: "", telephone: "" });
  };

  const submitStudent = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const method = editingId ? "PATCH" : "POST";
      const url = editingId ? `/api/students/${editingId}` : "/api/students";
      const body = editingId ? form : { ...form, is_demo: demoMode };
      await responseJson(await fetch(url, {
        method,
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }));
      setNotice(editingId ? "Fiche étudiant mise à jour." : "Étudiant ajouté.");
      resetForm();
      await load();
      onChanged?.();
    } catch (err) {
      setError(errorLabel(err instanceof Error ? err.message : "creation_impossible"));
    } finally {
      setBusy(false);
    }
  };

  const archiveStudent = async (student: Student) => {
    const label = student.archived_at ? "réactiver" : "archiver";
    if (!window.confirm(`Confirmer : ${label} ${student.nom} ? Les historiques sont conservés.`)) return;
    try {
      await responseJson(await fetch(`/api/students/${student.id}`, {
        method: "PATCH", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: !student.archived_at }),
      }));
      await load();
      onChanged?.();
    } catch (err) {
      setError(errorLabel(err instanceof Error ? err.message : "modification_impossible"));
    }
  };

  const deleteStudent = async (student: Student) => {
    const accepted = window.confirm(
      `SUPPRESSION DÉFINITIVE\n\n${student.nom} sera supprimé. Ses présences et ses règlements liés peuvent également être supprimés par les contraintes de base. Cette opération est irréversible.\n\nContinuer ?`
    );
    if (!accepted) return;
    try {
      await responseJson(await fetch(`/api/students/${student.id}`, {
        method: "DELETE", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "SUPPRIMER DEFINITIVEMENT" }),
      }));
      setNotice("Étudiant et données liées supprimés définitivement.");
      await load();
      onChanged?.();
    } catch (err) {
      setError(errorLabel(err instanceof Error ? err.message : "suppression_impossible"));
    }
  };

  const previewCsv = async (file?: File) => {
    setCsvPreview([]);
    setNotice("");
    setError("");
    if (!file) return;
    if (file.size > 5 * 1024 * 1024 || !file.name.toLowerCase().endsWith(".csv")) {
      setError("Sélectionne un fichier CSV de moins de 5 Mo. Les fichiers XLSX ne sont pas encore pris en charge.");
      return;
    }
    const text = await file.text();
    const parsed = parseDelimited(text.replace(/^\uFEFF/, ""));
    if (parsed.length < 2) {
      setError("Le fichier CSV est vide ou ne contient pas de lignes de données.");
      return;
    }
    const headers = parsed[0].map((h) => h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim());
    const index = (keys: string[]) => headers.findIndex((h) => keys.includes(h));
    const ix = {
      nom: index(["nom", "name"]), prenom: index(["prenom", "first_name", "firstname"]),
      code: index(["code_qr", "matricule", "code", "student_id"]),
      classe: index(["classe", "classe_id", "class"]),
      email: index(["email", "e-mail"]), telephone: index(["telephone", "phone", "tel"]),
    };
    const result = parsed.slice(1).map((cells, i) => {
      const get = (n: number) => n >= 0 ? cells[n] ?? "" : "";
      const classeValue = get(ix.classe);
      const match = classes.find((c) => c.id === classeValue || c.nom.toLowerCase() === classeValue.toLowerCase());
      const data = {
        nom: get(ix.nom), prenom: get(ix.prenom), code_qr: get(ix.code),
        classe_id: match?.id ?? "", email: get(ix.email), telephone: get(ix.telephone),
      };
      const errors = [
        ix.nom < 0 || !data.nom ? "nom manquant" : "",
        ix.code < 0 || !data.code_qr ? "matricule manquant" : "",
        ix.classe < 0 || !match ? "classe inconnue" : "",
        data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) ? "e-mail invalide" : "",
      ].filter(Boolean);
      return { row: i + 2, data, error: errors.join(", ") };
    });
    setCsvFileName(file.name);
    setCsvPreview(result);
  };

  const importCsv = async () => {
    if (!csvPreview.length || csvPreview.some((row) => row.error)) return;
    setBusy(true);
    setError("");
    try {
      const result = await responseJson<{ imported: number }>(await fetch("/api/students/import", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: csvPreview.map((r) => r.data), demo: demoMode }),
      }));
      setNotice(`${result.imported} étudiant(s) importé(s).`);
      setCsvPreview([]);
      setCsvFileName("");
      await load();
      onChanged?.();
    } catch (err) {
      setError(errorLabel(err instanceof Error ? err.message : "import_impossible"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={styles.manager}>
      <div className={styles.toolbar}>
        <label className={styles.field}>
          Recherche étudiant
          <input className={styles.input} value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} placeholder="Nom, prénom, matricule ou e-mail" />
        </label>
        <label className={styles.field} style={{ maxWidth: 190 }}>
          Affichage
          <select className={styles.select} value={archived ? "archived" : "active"} onChange={(e) => { setPage(1); setArchived(e.target.value === "archived"); }}>
            <option value="active">Étudiants actifs</option>
            <option value="archived">Étudiants archivés</option>
          </select>
        </label>
        <button className={styles.buttonSecondary} type="button" onClick={() => void load()}>Actualiser</button>
      </div>

      <div className={styles.panel}>
        <h2 className={styles.panelTitle}>{editingId ? "Modifier un étudiant" : "Ajouter un étudiant"}</h2>
        <form onSubmit={submitStudent}>
          <div className={styles.formGrid}>
            <label className={styles.field}>Nom *
              <input className={styles.input} required maxLength={100} value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
            </label>
            <label className={styles.field}>Prénom
              <input className={styles.input} maxLength={100} value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} />
            </label>
            <label className={styles.field}>Matricule / code QR
              <input className={styles.input} maxLength={64} placeholder="Généré automatiquement si vide" value={form.code_qr} onChange={(e) => setForm({ ...form, code_qr: e.target.value })} />
            </label>
            <label className={styles.field}>Classe *
              <select className={styles.select} required value={form.classe_id} onChange={(e) => setForm({ ...form, classe_id: e.target.value })}>
                <option value="">Sélectionner une classe</option>
                {classes.filter((c) => Boolean(c.is_demo) === demoMode).map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </label>
            <label className={styles.field}>E-mail
              <input className={styles.input} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <label className={styles.field}>Téléphone
              <input className={styles.input} maxLength={32} value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
            </label>
          </div>
          <div className={styles.actions} style={{ marginTop: 12 }}>
            <button className={styles.button} type="submit" disabled={busy}>{busy ? "Enregistrement…" : editingId ? "Enregistrer les changements" : "Ajouter l'étudiant"}</button>
            {editingId && <button className={styles.buttonSecondary} type="button" onClick={resetForm}>Annuler</button>}
          </div>
        </form>
      </div>

      <div className={styles.panel}>
        <h2 className={styles.panelTitle}>Importation CSV</h2>
        <div className={styles.toolbar}>
          <label className={styles.field}>Fichier CSV (max. 5 Mo)
            <input className={styles.input} type="file" accept=".csv,text/csv" onChange={(e) => void previewCsv(e.target.files?.[0])} />
          </label>
          <span className={styles.hint}>Colonnes reconnues : nom, prénom, matricule, classe (nom ou ID), e-mail, téléphone.</span>
        </div>
        <p className={styles.hint}>L'importation est atomique : aucune ligne n'est ajoutée tant qu'une erreur ou un doublon n'a pas été corrigé. XLSX n'est pas encore pris en charge.</p>
        {csvPreview.length > 0 && (
          <>
            <p className={styles.hint}>{csvFileName} · {csvPreview.length} ligne(s) · {csvPreview.filter((r) => !r.error).length} valide(s) · {csvPreview.filter((r) => r.error).length} erreur(s)</p>
            <div className={styles.preview}>
              {csvPreview.slice(0, 80).map((row) => (
                <div className={styles.previewRow} key={row.row}>
                  <span>{row.row}. {row.data.nom} {row.data.prenom}</span>
                  <span>{row.data.code_qr}</span>
                  <span>{classes.find((c) => c.id === row.data.classe_id)?.nom ?? "Classe inconnue"}</span>
                  <span style={{ color: row.error ? "#9a2929" : "#176344" }}>{row.error || "Prêt"}</span>
                </div>
              ))}
            </div>
            <div className={styles.actions}>
              <button className={styles.button} type="button" disabled={busy || csvPreview.some((r) => r.error)} onClick={() => void importCsv()}>Importer {csvPreview.length} ligne(s)</button>
              <button className={styles.buttonSecondary} type="button" onClick={() => setCsvPreview([])}>Effacer l'aperçu</button>
            </div>
          </>
        )}
      </div>

      {error && <p className={styles.error} role="alert">{errorLabel(error)}</p>}
      {notice && <p className={styles.success} role="status">{notice}</p>}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>Étudiant</th><th>Matricule</th><th>Classe</th><th>Contact</th><th>Actions</th></tr></thead>
          <tbody>
            {students.map((student) => (
              <tr key={student.id}>
                <td><span className={styles.name}>{[student.prenom, student.nom].filter(Boolean).join(" ")}</span></td>
                <td>{student.code_qr}</td>
                <td>{classes.find((c) => c.id === student.classe_id)?.nom ?? "—"}</td>
                <td>{student.email || student.telephone || "—"}</td>
                <td><div className={styles.actions}>
                  <button className={styles.buttonSecondary} type="button" onClick={() => {
                    setEditingId(student.id);
                    setForm({ nom: student.nom, prenom: student.prenom ?? "", code_qr: student.code_qr, classe_id: student.classe_id, email: student.email ?? "", telephone: student.telephone ?? "" });
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}>Modifier</button>
                  <button className={styles.buttonSecondary} type="button" onClick={() => void archiveStudent(student)}>{student.archived_at ? "Réactiver" : "Archiver"}</button>
                  <button className={styles.buttonDanger} type="button" onClick={() => void deleteStudent(student)}>Supprimer</button>
                </div></td>
              </tr>
            ))}
            {!loading && students.length === 0 && <tr><td colSpan={5} className={styles.empty}>Aucun étudiant pour ces filtres.</td></tr>}
          </tbody>
        </table>
      </div>
      {loading && <p className={styles.hint}>Chargement des étudiants…</p>}
      <div className={styles.pagination}>
        <span>{total} résultat(s) · page {page}</span>
        <div className={styles.actions}>
          <button className={styles.buttonSecondary} type="button" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>Précédent</button>
          <button className={styles.buttonSecondary} type="button" disabled={page * 50 >= total || loading} onClick={() => setPage((p) => p + 1)}>Suivant</button>
        </div>
      </div>
    </section>
  );
}

export function CoursesManager({ demoMode, classes, onChanged }: SharedProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [archived, setArchived] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState({ nom: "", classe_id: "", enseignant: "", salle: "", jour_semaine: String(new Date().getDay()), heure_debut: "08:00", heure_fin: "09:00" });

  const load = useCallback(async () => {
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), perPage: "50" });
      if (q.trim()) params.set("q", q.trim());
      if (archived) params.set("archived", "1");
      if (demoMode) params.set("demo", "1");
      const result = await responseJson<{ courses: Course[]; total: number }>(await fetch(`/api/courses?${params}`, { credentials: "same-origin" }));
      setCourses(result.courses);
      setTotal(result.total);
    } catch (err) { setError(errorLabel(err instanceof Error ? err.message : "erreur_inconnue")); }
  }, [page, q, archived, demoMode]);
  useEffect(() => { void load(); }, [load]);

  const reset = () => {
    setEditingId("");
    setForm({ nom: "", classe_id: "", enseignant: "", salle: "", jour_semaine: String(new Date().getDay()), heure_debut: "08:00", heure_fin: "09:00" });
  };
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const method = editingId ? "PATCH" : "POST";
      const url = editingId ? `/api/courses/${editingId}` : "/api/courses";
      await responseJson(await fetch(url, {
        method, credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, jour_semaine: Number(form.jour_semaine), is_demo: demoMode }),
      }));
      setNotice(editingId ? "Cours mis à jour." : "Cours créé.");
      reset(); await load(); onChanged?.();
    } catch (err) { setError(errorLabel(err instanceof Error ? err.message : "creation_impossible")); }
    finally { setBusy(false); }
  };
  const toggleArchive = async (course: Course) => {
    try {
      await responseJson(await fetch(`/api/courses/${course.id}`, {
        method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: !course.archived_at }),
      }));
      await load(); onChanged?.();
    } catch (err) { setError(errorLabel(err instanceof Error ? err.message : "modification_impossible")); }
  };
  const deleteCourse = async (course: Course) => {
    if (!window.confirm(`Supprimer définitivement « ${course.nom} » ? Les pointages liés peuvent être supprimés avec le cours. Cette action est irréversible.`)) return;
    try {
      await responseJson(await fetch(`/api/courses/${course.id}`, {
        method: "DELETE", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "SUPPRIMER DEFINITIVEMENT" }),
      }));
      setNotice("Cours et pointages liés supprimés.");
      await load(); onChanged?.();
    } catch (err) { setError(errorLabel(err instanceof Error ? err.message : "suppression_impossible")); }
  };

  return (
    <section className={styles.manager}>
      <div className={styles.toolbar}>
        <label className={styles.field}>Recherche cours
          <input className={styles.input} value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} placeholder="Nom du cours" />
        </label>
        <label className={styles.field} style={{ maxWidth: 190 }}>Affichage
          <select className={styles.select} value={archived ? "archived" : "active"} onChange={(e) => { setPage(1); setArchived(e.target.value === "archived"); }}>
            <option value="active">Cours actifs</option><option value="archived">Cours archivés</option>
          </select>
        </label>
        <button className={styles.buttonSecondary} type="button" onClick={() => void load()}>Actualiser</button>
      </div>
      <div className={styles.panel}>
        <h2 className={styles.panelTitle}>{editingId ? "Modifier un cours" : "Créer un cours"}</h2>
        <form onSubmit={submit}>
          <div className={styles.formGrid}>
            <label className={styles.field}>Nom du cours *
              <input className={styles.input} required maxLength={120} value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
            </label>
            <label className={styles.field}>Classe *
              <select className={styles.select} required value={form.classe_id} onChange={(e) => setForm({ ...form, classe_id: e.target.value })}>
                <option value="">Sélectionner</option>
                {classes.filter((c) => Boolean(c.is_demo) === demoMode).map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </label>
            <label className={styles.field}>Enseignant
              <input className={styles.input} maxLength={120} value={form.enseignant} onChange={(e) => setForm({ ...form, enseignant: e.target.value })} />
            </label>
            <label className={styles.field}>Salle
              <input className={styles.input} maxLength={64} value={form.salle} onChange={(e) => setForm({ ...form, salle: e.target.value })} />
            </label>
            <label className={styles.field}>Jour *
              <select className={styles.select} value={form.jour_semaine} onChange={(e) => setForm({ ...form, jour_semaine: e.target.value })}>
                {DAYS.map((day, i) => <option key={day} value={i}>{day}</option>)}
              </select>
            </label>
            <label className={styles.field}>Début *
              <input className={styles.input} type="time" required value={form.heure_debut} onChange={(e) => setForm({ ...form, heure_debut: e.target.value })} />
            </label>
            <label className={styles.field}>Fin *
              <input className={styles.input} type="time" required value={form.heure_fin} onChange={(e) => setForm({ ...form, heure_fin: e.target.value })} />
            </label>
          </div>
          <div className={styles.actions} style={{ marginTop: 12 }}>
            <button className={styles.button} type="submit" disabled={busy}>{busy ? "Enregistrement…" : editingId ? "Enregistrer le cours" : "Créer le cours"}</button>
            {editingId && <button className={styles.buttonSecondary} type="button" onClick={reset}>Annuler</button>}
          </div>
        </form>
        <p className={styles.hint}>Les chevauchements de classe, d'enseignant et de salle sont vérifiés côté serveur avant l'enregistrement.</p>
      </div>
      {error && <p className={styles.error} role="alert">{errorLabel(error)}</p>}
      {notice && <p className={styles.success} role="status">{notice}</p>}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>Jour</th><th>Cours</th><th>Classe</th><th>Enseignant</th><th>Horaire</th><th>Salle</th><th>Actions</th></tr></thead>
          <tbody>
            {courses.map((course) => (
              <tr key={course.id}>
                <td>{DAYS[course.jour_semaine]}</td>
                <td className={styles.name}>{course.nom}</td>
                <td>{classes.find((c) => c.id === course.classe_id)?.nom ?? "—"}</td>
                <td>{course.enseignant ?? "—"}</td>
                <td>{course.heure_debut.slice(0, 5)}–{course.heure_fin.slice(0, 5)}</td>
                <td>{course.salle ?? "—"}</td>
                <td><div className={styles.actions}>
                  <button className={styles.buttonSecondary} type="button" onClick={() => {
                    setEditingId(course.id);
                    setForm({ nom: course.nom, classe_id: course.classe_id, enseignant: course.enseignant ?? "", salle: course.salle ?? "", jour_semaine: String(course.jour_semaine), heure_debut: course.heure_debut.slice(0, 5), heure_fin: course.heure_fin.slice(0, 5) });
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}>Modifier</button>
                  <button className={styles.buttonSecondary} type="button" onClick={() => void toggleArchive(course)}>{course.archived_at ? "Réactiver" : "Archiver"}</button>
                  <button className={styles.buttonDanger} type="button" onClick={() => void deleteCourse(course)}>Supprimer</button>
                </div></td>
              </tr>
            ))}
            {courses.length === 0 && <tr><td colSpan={7} className={styles.empty}>Aucun cours pour ces filtres.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className={styles.pagination}>
        <span>{total} cours · page {page}</span>
        <div className={styles.actions}>
          <button className={styles.buttonSecondary} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Précédent</button>
          <button className={styles.buttonSecondary} disabled={page * 50 >= total} onClick={() => setPage((p) => p + 1)}>Suivant</button>
        </div>
      </div>
    </section>
  );
}

export function AttendanceManager({ demoMode, classes, onChanged }: SharedProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [studentId, setStudentId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [hour, setHour] = useState(new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Conakry", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date()));
  const [status, setStatus] = useState("present");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [editStatus, setEditStatus] = useState("present");
  const [editReason, setEditReason] = useState("");

  const loadOptions = useCallback(async () => {
    try {
      const [studentResult, courseResult] = await Promise.all([
        responseJson<{ students: Student[] }>(await fetch(`/api/students?perPage=100${demoMode ? "&demo=1" : ""}`, { credentials: "same-origin" })),
        responseJson<{ courses: Course[] }>(await fetch(`/api/courses?perPage=100${demoMode ? "&demo=1" : ""}`, { credentials: "same-origin" })),
      ]);
      setStudents(studentResult.students);
      setCourses(courseResult.courses);
    } catch (err) { setError(errorLabel(err instanceof Error ? err.message : "erreur_base")); }
  }, [demoMode]);
  const loadRecords = useCallback(async () => {
    try {
      const result = await responseJson<{ attendances: any[] }>(await fetch(`/api/attendance?date=${date}&perPage=100`, { credentials: "same-origin" }));
      setRecords(result.attendances);
    } catch (err) { setError(errorLabel(err instanceof Error ? err.message : "erreur_base")); }
  }, [date]);
  useEffect(() => { void loadOptions(); }, [loadOptions]);
  useEffect(() => { void loadRecords(); }, [loadRecords]);

  const filteredCourses = courses.filter((course) => course.classe_id === students.find((s) => s.id === studentId)?.classe_id);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      await responseJson(await fetch("/api/attendance", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId, course_id: courseId, date, heure: hour, statut: status, motif: reason }),
      }));
      setNotice("Présence enregistrée. L'opération est identifiée comme saisie manuelle.");
      setReason(""); await loadRecords(); onChanged?.();
    } catch (err) { setError(errorLabel(err instanceof Error ? err.message : "enregistrement_impossible")); }
    finally { setBusy(false); }
  };
  const submitCorrection = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); if (!editing) return;
    setBusy(true); setError("");
    try {
      await responseJson(await fetch(`/api/attendance/${editing.id}`, {
        method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut: editStatus, motif: editReason }),
      }));
      setNotice("Correction enregistrée avec justification.");
      setEditing(null); setEditReason(""); await loadRecords(); onChanged?.();
    } catch (err) { setError(errorLabel(err instanceof Error ? err.message : "correction_impossible")); }
    finally { setBusy(false); }
  };

  return (
    <section className={styles.manager}>
      <div className={styles.panel}>
        <h2 className={styles.panelTitle}>Saisie manuelle d'une présence</h2>
        <form onSubmit={submit}>
          <div className={styles.formGrid}>
            <label className={styles.field}>Étudiant *
              <select className={styles.select} required value={studentId} onChange={(e) => { setStudentId(e.target.value); setCourseId(""); }}>
                <option value="">Sélectionner un étudiant</option>
                {students.filter((student) => Boolean(student.is_demo) === demoMode).map((student) => <option key={student.id} value={student.id}>{student.prenom ? student.prenom + " " : ""}{student.nom} — {classes.find((c) => c.id === student.classe_id)?.nom ?? "—"}</option>)}
              </select>
            </label>
            <label className={styles.field}>Cours *
              <select className={styles.select} required value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                <option value="">Sélectionner un cours</option>
                {filteredCourses.filter((course) => Boolean(course.is_demo) === demoMode).map((course) => <option key={course.id} value={course.id}>{DAYS[course.jour_semaine]} · {course.nom} · {course.heure_debut.slice(0, 5)}</option>)}
              </select>
            </label>
            <label className={styles.field}>Date scolaire *
              <input className={styles.input} type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className={styles.field}>Heure *
              <input className={styles.input} type="time" required value={hour} onChange={(e) => setHour(e.target.value)} />
            </label>
            <label className={styles.field}>Statut *
              <select className={styles.select} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="present">Présent</option><option value="absent">Absent</option><option value="retard">En retard</option>
              </select>
            </label>
            <label className={styles.field}>Justification obligatoire *
              <input className={styles.input} required minLength={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motif de la saisie" />
            </label>
          </div>
          <div className={styles.actions} style={{ marginTop: 12 }}>
            <button className={styles.button} type="submit" disabled={busy || !studentId || !courseId}>{busy ? "Enregistrement…" : "Enregistrer"}</button>
          </div>
        </form>
      </div>
      {editing && (
        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>Corriger une présence — {[editing.students?.prenom, editing.students?.nom].filter(Boolean).join(" ")}</h2>
          <form onSubmit={submitCorrection}>
            <div className={styles.formGrid}>
              <label className={styles.field}>Nouveau statut
                <select className={styles.select} value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                  <option value="present">Présent</option><option value="absent">Absent</option><option value="retard">En retard</option>
                </select>
              </label>
              <label className={styles.field}>Justification obligatoire
                <input className={styles.input} required minLength={3} maxLength={500} value={editReason} onChange={(e) => setEditReason(e.target.value)} />
              </label>
            </div>
            <div className={styles.actions} style={{ marginTop: 12 }}>
              <button className={styles.button} disabled={busy}>Enregistrer la correction</button>
              <button className={styles.buttonSecondary} type="button" onClick={() => setEditing(null)}>Annuler</button>
            </div>
          </form>
        </div>
      )}
      {error && <p className={styles.error} role="alert">{errorLabel(error)}</p>}
      {notice && <p className={styles.success} role="status">{notice}</p>}
      <div className={styles.toolbar}>
        <label className={styles.field} style={{ maxWidth: 240 }}>Consulter l'historique
          <input className={styles.input} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <button className={styles.buttonSecondary} type="button" onClick={() => void loadRecords()}>Actualiser</button>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>Heure</th><th>Étudiant</th><th>Classe</th><th>Cours</th><th>Statut</th><th>Origine</th><th>Justification</th><th>Actions</th></tr></thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id}>
                <td>{new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Conakry", hour: "2-digit", minute: "2-digit" }).format(new Date(record.scanned_at))}</td>
                <td className={styles.name}>{[record.students?.prenom, record.students?.nom].filter(Boolean).join(" ")}</td>
                <td>{classes.find((c) => c.id === record.students?.classe_id)?.nom ?? "—"}</td>
                <td>{record.courses?.nom ?? "—"}</td>
                <td><span className={styles.status}>{record.statut === "retard" ? "RETARD" : record.statut?.toUpperCase() ?? "PRÉSENT"}</span></td>
                <td>{record.source === "manual" ? "Saisie" : "Scan"}</td>
                <td>{record.motif ?? "—"}</td>
                <td><button className={styles.buttonSecondary} type="button" onClick={() => {
                  setEditing(record); setEditStatus(record.statut ?? "present"); setEditReason("");
                }}>Corriger</button></td>
              </tr>
            ))}
            {records.length === 0 && <tr><td colSpan={8} className={styles.empty}>Aucun pointage pour cette date.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type ManagedUser = { id: string; email: string; full_name: string; role: "admin" | "dev"; active: boolean; created_at: string; last_sign_in_at: string | null };

export function UsersManager() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [q, setQ] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"admin" | "dev">("admin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const params = new URLSearchParams({ page: "1", perPage: "100" });
      if (q.trim()) params.set("q", q.trim());
      const result = await responseJson<{ users: ManagedUser[] }>(await fetch(`/api/admin/users?${params}`, { credentials: "same-origin" }));
      setUsers(result.users);
    } catch (err) { setError(errorLabel(err instanceof Error ? err.message : "erreur_comptes")); }
  }, [q]);
  useEffect(() => { void load(); }, [load]);

  const invite = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      await responseJson(await fetch("/api/admin/users", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, full_name: fullName, role }),
      }));
      setNotice("Invitation envoyée. Le compte devient actif après acceptation et définition de son mot de passe.");
      setEmail(""); setFullName(""); setRole("admin"); await load();
    } catch (err) { setError(errorLabel(err instanceof Error ? err.message : "invitation_impossible")); }
    finally { setBusy(false); }
  };
  const change = async (user: ManagedUser, updates: { role?: string; active?: boolean }) => {
    try {
      await responseJson(await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      }));
      await load();
    } catch (err) { setError(errorLabel(err instanceof Error ? err.message : "modification_impossible")); }
  };
  const reset = async (user: ManagedUser) => {
    if (!window.confirm(`Envoyer un lien de réinitialisation à ${user.email} ?`)) return;
    try {
      await responseJson(await fetch(`/api/admin/users/${user.id}/reset`, { method: "POST", credentials: "same-origin" }));
      setNotice(`Demande de réinitialisation envoyée à ${user.email}.`);
    } catch (err) { setError(errorLabel(err instanceof Error ? err.message : "reinitialisation_impossible")); }
  };

  return (
    <section className={styles.manager}>
      <div className={styles.panel}>
        <h2 className={styles.panelTitle}>Inviter un utilisateur</h2>
        <form onSubmit={invite}>
          <div className={styles.formGrid}>
            <label className={styles.field}>Nom complet *
              <input className={styles.input} required minLength={2} maxLength={100} value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </label>
            <label className={styles.field}>Adresse e-mail *
              <input className={styles.input} required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className={styles.field}>Rôle
              <select className={styles.select} value={role} onChange={(e) => setRole(e.target.value as "admin" | "dev")}>
                <option value="admin">ADMIN</option><option value="dev">DEV</option>
              </select>
            </label>
          </div>
          <div className={styles.actions} style={{ marginTop: 12 }}>
            <button className={styles.button} type="submit" disabled={busy}>{busy ? "Envoi…" : "Envoyer l'invitation"}</button>
          </div>
        </form>
      </div>
      <div className={styles.toolbar}>
        <label className={styles.field}>Recherche
          <input className={styles.input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom ou adresse e-mail" />
        </label>
        <button className={styles.buttonSecondary} type="button" onClick={() => void load()}>Actualiser</button>
      </div>
      {error && <p className={styles.error} role="alert">{errorLabel(error)}</p>}
      {notice && <p className={styles.success} role="status">{notice}</p>}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>Utilisateur</th><th>Rôle</th><th>État</th><th>Dernière connexion</th><th>Actions</th></tr></thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td><span className={styles.name}>{user.full_name || user.email}</span><br /><span className={styles.muted}>{user.email}</span></td>
                <td><select className={styles.select} value={user.role} onChange={(e) => void change(user, { role: e.target.value })}>
                  <option value="admin">ADMIN</option><option value="dev">DEV</option>
                </select></td>
                <td><span className={styles.status}>{user.active ? "ACTIF" : "DÉSACTIVÉ"}</span></td>
                <td>{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString("fr-FR") : "Jamais"}</td>
                <td><div className={styles.actions}>
                  <button className={styles.buttonSecondary} type="button" onClick={() => void change(user, { active: !user.active })}>{user.active ? "Désactiver" : "Réactiver"}</button>
                  <button className={styles.buttonSecondary} type="button" onClick={() => void reset(user)}>Réinitialiser</button>
                </div></td>
              </tr>
            ))}
            {!users.length && <tr><td colSpan={5} className={styles.empty}>Aucun compte trouvé.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type AuditEvent = { id: string; actor_id: string | null; actor_role: string | null; action: string; entity_table: string; entity_id: string | null; old_data: unknown; new_data: unknown; created_at: string; reason: string | null };

export function AuditManager() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), perPage: "50" });
      if (action) params.set("action", action);
      if (entity) params.set("entity", entity);
      const result = await responseJson<{ events: AuditEvent[]; total: number }>(await fetch(`/api/admin/audit?${params}`, { credentials: "same-origin" }));
      setEvents(result.events); setTotal(result.total);
    } catch (err) { setError(errorLabel(err instanceof Error ? err.message : "journal_indisponible")); }
  }, [page, action, entity]);
  useEffect(() => { void load(); }, [load]);

  return (
    <section className={styles.manager}>
      <div className={styles.toolbar}>
        <label className={styles.field}>Action
          <select className={styles.select} value={action} onChange={(e) => { setPage(1); setAction(e.target.value); }}>
            <option value="">Toutes</option>
            {["INSERT", "UPDATE", "DELETE", "INVITE", "ROLE_CHANGE", "ACCOUNT_DISABLE", "ACCOUNT_ENABLE", "PASSWORD_RESET"].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label className={styles.field}>Entité
          <select className={styles.select} value={entity} onChange={(e) => { setPage(1); setEntity(e.target.value); }}>
            <option value="">Toutes</option>
            {["students", "courses", "classes", "attendance", "auth.users"].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <button className={styles.buttonSecondary} type="button" onClick={() => void load()}>Actualiser</button>
      </div>
      {error && <p className={styles.error} role="alert">{errorLabel(error)}</p>}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>Date</th><th>Acteur</th><th>Action</th><th>Entité</th><th>Ancienne valeur</th><th>Nouvelle valeur</th></tr></thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td>{new Date(event.created_at).toLocaleString("fr-FR", { timeZone: "Africa/Conakry" })}</td>
                <td>{event.actor_role ?? "Système"}<br /><span className={styles.muted}>{event.actor_id ?? "—"}</span></td>
                <td><span className={styles.status}>{event.action}</span></td>
                <td>{event.entity_table}<br /><span className={styles.muted}>{event.entity_id ?? "—"}</span></td>
                <td><code>{event.old_data ? JSON.stringify(event.old_data) : "—"}</code></td>
                <td><code>{event.new_data ? JSON.stringify(event.new_data) : event.reason ?? "—"}</code></td>
              </tr>
            ))}
            {events.length === 0 && <tr><td colSpan={6} className={styles.empty}>Aucun événement d'audit trouvé.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className={styles.pagination}>
        <span>{total} événement(s) · page {page}</span>
        <div className={styles.actions}>
          <button className={styles.buttonSecondary} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Précédent</button>
          <button className={styles.buttonSecondary} disabled={page * 50 >= total} onClick={() => setPage((p) => p + 1)}>Suivant</button>
        </div>
      </div>
    </section>
  );
}
