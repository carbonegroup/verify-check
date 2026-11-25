"use client";

import { useCallback, useEffect, useState } from "react";
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
type AttendanceRecord = {
  id: string;
  student_id: string;
  course_id: string;
  scanned_at: string;
  statut?: "present" | "absent" | "retard";
  source?: "scan" | "manual";
  motif?: string | null;
  students?: { id: string; nom: string; prenom?: string | null; classe_id: string };
  courses?: { id: string; nom: string; classe_id: string; salle: string | null };
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

function xmlText(element: Element): string {
  const nodes = Array.from(element.getElementsByTagName("*"));
  return nodes.filter((node) => node.localName === "t").map((node) => node.textContent ?? "").join("");
}

function normalizeZipPath(path: string): string {
  const parts: string[] = [];
  for (const part of path.replace(/^\//, "").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

async function parseXlsx(file: File): Promise<string[][]> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("Ce navigateur ne prend pas en charge la décompression XLSX. Exporte le classeur en CSV.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const read32 = (offset: number) => view.getUint32(offset, true);
  const read16 = (offset: number) => view.getUint16(offset, true);
  let eocd = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65558); offset -= 1) {
    if (read32(offset) === 0x06054b50) { eocd = offset; break; }
  }
  if (eocd < 0) throw new Error("Fichier XLSX invalide : répertoire ZIP absent.");
  const totalEntries = read16(eocd + 10);
  const centralOffset = read32(eocd + 16);
  if (totalEntries > 1000) throw new Error("Le classeur contient trop de fichiers internes.");
  const entries = new Map<string, Uint8Array>();
  let cursor = centralOffset;
  let totalUncompressed = 0;
  for (let i = 0; i < totalEntries; i += 1) {
    if (read32(cursor) !== 0x02014b50) throw new Error("Répertoire XLSX endommagé.");
    const method = read16(cursor + 10);
    const compressedSize = read32(cursor + 20);
    const uncompressedSize = read32(cursor + 24);
    const nameLength = read16(cursor + 28);
    const extraLength = read16(cursor + 30);
    const commentLength = read16(cursor + 32);
    const localOffset = read32(cursor + 42);
    const fileName = new TextDecoder().decode(bytes.slice(cursor + 46, cursor + 46 + nameLength));
    cursor += 46 + nameLength + extraLength + commentLength;
    if (!fileName || fileName.endsWith("/")) continue;
    if (uncompressedSize > 10 * 1024 * 1024) throw new Error("Un fichier interne XLSX dépasse 10 Mo.");
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > 25 * 1024 * 1024) throw new Error("Le classeur dépasse la limite de décompression (25 Mo).");
    if (read32(localOffset) !== 0x04034b50) throw new Error("En-tête XLSX invalide.");
    const localNameLength = read16(localOffset + 26);
    const localExtraLength = read16(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataOffset, dataOffset + compressedSize);
    let uncompressed: Uint8Array;
    if (method === 0) {
      uncompressed = compressed;
    } else if (method === 8) {
      const blob = new Blob([compressed.buffer.slice(compressed.byteOffset, compressed.byteOffset + compressed.byteLength)]);
      const stream = blob.stream().pipeThrough(new DecompressionStream("deflate-raw"));
      uncompressed = new Uint8Array(await new Response(stream).arrayBuffer());
    } else {
      throw new Error("Méthode de compression XLSX non prise en charge.");
    }
    if (uncompressed.length !== uncompressedSize) throw new Error("Taille décompressée XLSX incohérente.");
    entries.set(normalizeZipPath(fileName), uncompressed);
  }

  const readXml = (name: string): Document => {
    const data = entries.get(name);
    if (!data) throw new Error(`Fichier XLSX manquant : ${name}`);
    const document = new DOMParser().parseFromString(new TextDecoder().decode(data), "application/xml");
    if (document.getElementsByTagName("parsererror").length) throw new Error(`XML XLSX invalide : ${name}`);
    return document;
  };
  const workbook = readXml("xl/workbook.xml");
  const firstSheet = Array.from(workbook.getElementsByTagName("*")).find((node) => node.localName === "sheet");
  if (!firstSheet) throw new Error("Le classeur ne contient aucune feuille.");
  const relationId = firstSheet.getAttribute("r:id") ?? firstSheet.getAttribute("id") ?? "";
  const relationships = readXml("xl/_rels/workbook.xml.rels");
  const relationship = Array.from(relationships.getElementsByTagName("*")).find(
    (node) => node.localName === "Relationship" && node.getAttribute("Id") === relationId
  );
  const target = relationship?.getAttribute("Target");
  if (!target) throw new Error("La première feuille XLSX n'est pas accessible.");
  const sheetPath = normalizeZipPath(target.startsWith("/") ? target : `xl/${target}`);
  const sheet = readXml(sheetPath);
  const sharedStrings = entries.has("xl/sharedStrings.xml")
    ? Array.from(readXml("xl/sharedStrings.xml").getElementsByTagName("*"))
        .filter((node) => node.localName === "si")
        .map(xmlText)
    : [];
  const rows = Array.from(sheet.getElementsByTagName("*")).filter((node) => node.localName === "row");
  return rows.map((row) => {
    const values: string[] = [];
    const cells = Array.from(row.getElementsByTagName("*")).filter((node) => node.localName === "c");
    for (const cell of cells) {
      const reference = cell.getAttribute("r") ?? "";
      const columnName = reference.match(/^[A-Z]+/)?.[0] ?? "";
      let column = 0;
      for (const letter of columnName) column = column * 26 + letter.charCodeAt(0) - 64;
      column -= 1;
      if (column < 0 || column > 200) continue;
      const type = cell.getAttribute("t");
      const valueNode = Array.from(cell.getElementsByTagName("*")).find((node) => node.localName === "v");
      let value = valueNode?.textContent ?? "";
      if (type === "s") value = sharedStrings[Number(value)] ?? "";
      else if (type === "inlineStr") value = xmlText(cell);
      values[column] = value;
    }
    return values.map((value) => value ?? "");
  }).filter((row) => row.some((cell) => cell.trim() !== ""));
}

export function StudentsManager({ demoMode, classes, onChanged }: SharedProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [q, setQ] = useState("");
  const [classFilter, setClassFilter] = useState("");
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
      if (classFilter) params.set("classe", classFilter);
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
  }, [page, q, classFilter, archived, demoMode]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronise the view with server-owned data.
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
    const extension = file.name.toLowerCase().split(".").pop();
    if (file.size > 5 * 1024 * 1024 || (extension !== "csv" && extension !== "xlsx")) {
      setError("Sélectionne un fichier CSV ou XLSX de moins de 5 Mo.");
      return;
    }
    const parsed = extension === "xlsx"
      ? await parseXlsx(file)
      : parseDelimited((await file.text()).replace(/^\uFEFF/, ""));
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
        <label className={styles.field} style={{ maxWidth: 230 }}>
          Classe
          <select className={styles.select} value={classFilter} onChange={(e) => { setPage(1); setClassFilter(e.target.value); }}>
            <option value="">Toutes les classes</option>
            {classes.filter((c) => Boolean(c.is_demo) === demoMode).map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
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
          <label className={styles.field}>Fichier CSV ou XLSX (max. 5 Mo)
            <input className={styles.input} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => void previewCsv(e.target.files?.[0])} />
          </label>
          <span className={styles.hint}>Colonnes reconnues : nom, prénom, matricule, classe (nom ou ID), e-mail, téléphone.</span>
        </div>
        <p className={styles.hint}>L’importation est atomique : aucune ligne n’est ajoutée tant qu’une erreur ou un doublon n’a pas été corrigé. Pour conserver les matricules avec des zéros initiaux, formate cette colonne en texte dans Excel avant l’export.</p>
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
              <button className={styles.buttonSecondary} type="button" onClick={() => setCsvPreview([])}>Effacer l’aperçu</button>
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
  const [classFilter, setClassFilter] = useState("");
  const [dayFilter, setDayFilter] = useState("");
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
      if (classFilter) params.set("classe", classFilter);
      if (dayFilter !== "") params.set("jour", dayFilter);
      if (archived) params.set("archived", "1");
      if (demoMode) params.set("demo", "1");
      const result = await responseJson<{ courses: Course[]; total: number }>(await fetch(`/api/courses?${params}`, { credentials: "same-origin" }));
      setCourses(result.courses);
      setTotal(result.total);
    } catch (err) { setError(errorLabel(err instanceof Error ? err.message : "erreur_inconnue")); }
  }, [page, q, classFilter, dayFilter, archived, demoMode]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronise the view with server-owned data.
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
        <label className={styles.field} style={{ maxWidth: 220 }}>Classe
          <select className={styles.select} value={classFilter} onChange={(e) => { setPage(1); setClassFilter(e.target.value); }}>
            <option value="">Toutes les classes</option>
            {classes.filter((c) => Boolean(c.is_demo) === demoMode).map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </label>
        <label className={styles.field} style={{ maxWidth: 170 }}>Jour
          <select className={styles.select} value={dayFilter} onChange={(e) => { setPage(1); setDayFilter(e.target.value); }}>
            <option value="">Toute la semaine</option>
            {DAYS.map((day, i) => <option key={day} value={i}>{day}</option>)}
          </select>
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
        <p className={styles.hint}>Les chevauchements de classe, d’enseignant et de salle sont vérifiés côté serveur avant l’enregistrement.</p>
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
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [search, setSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [filterClass, setFilterClass] = useState("");
  const [filterCourse, setFilterCourse] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [studentId, setStudentId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [hour, setHour] = useState(new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Conakry", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date()));
  const [status, setStatus] = useState("present");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<AttendanceRecord | null>(null);
  const [editStatus, setEditStatus] = useState("present");
  const [editReason, setEditReason] = useState("");

  // Reset all locally selected records when switching between real and demo datasets.
  useEffect(() => {
    setStudentId("");
    setCourseId("");
    setStudents([]);
    setCourses([]);
    setStudentSearch("");
  }, [demoMode]);

  const loadOptions = useCallback(async () => {
    try {
      const studentResult = await responseJson<{ students: Student[] }>(await fetch(`/api/students?perPage=50${demoMode ? "&demo=1" : ""}${studentSearch.trim() ? `&q=${encodeURIComponent(studentSearch.trim())}` : ""}`, { credentials: "same-origin" }));
      setStudents(studentResult.students);
    } catch (err) { setError(errorLabel(err instanceof Error ? err.message : "erreur_base")); }
  }, [demoMode, studentSearch]);
  const loadRecords = useCallback(async () => {
    try {
      const params = new URLSearchParams({ date, page: String(page), perPage: "50" });
      if (demoMode) params.set("demo", "1");
      if (search.trim()) params.set("q", search.trim());
      if (filterClass) params.set("classe", filterClass);
      if (filterCourse) params.set("cours", filterCourse);
      if (filterStatus) params.set("statut", filterStatus);
      const result = await responseJson<{ attendances: AttendanceRecord[]; total: number }>(await fetch(`/api/attendance?${params}`, { credentials: "same-origin" }));
      setRecords(result.attendances);
      setTotalRecords(result.total);
    } catch (err) { setError(errorLabel(err instanceof Error ? err.message : "erreur_base")); }
  }, [date, page, demoMode, search, filterClass, filterCourse, filterStatus]);
  // Debounce the server-side student search; course options are refreshed at the same time.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronise the view with server-owned data.
  useEffect(() => {
    const timer = window.setTimeout(() => { void loadOptions(); }, 300);
    return () => window.clearTimeout(timer);
  }, [loadOptions]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronise the view with server-owned data.
  useEffect(() => { void loadRecords(); }, [loadRecords]);

  const loadCoursesForStudent = async (selectedStudentId: string) => {
    const selected = students.find((student) => student.id === selectedStudentId);
    setCourses([]);
    setCourseId("");
    if (!selected) return;
    try {
      const params = new URLSearchParams({ perPage: "100", classe: selected.classe_id });
      if (demoMode) params.set("demo", "1");
      const result = await responseJson<{ courses: Course[] }>(await fetch(`/api/courses?${params}`, { credentials: "same-origin" }));
      setCourses(result.courses.filter((course) => Boolean(course.is_demo) === demoMode));
    } catch (err) {
      setError(errorLabel(err instanceof Error ? err.message : "erreur_base"));
    }
  };

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
        <h2 className={styles.panelTitle}>Saisie manuelle d’une présence</h2>
        <form onSubmit={submit}>
          <div className={styles.formGrid}>
            <label className={styles.field}>Rechercher un étudiant
              <input className={styles.input} value={studentSearch} onChange={(e) => { setStudentSearch(e.target.value); setStudentId(""); setCourseId(""); }} placeholder="Nom, prénom ou matricule" />
            </label>
            <label className={styles.field}>Étudiant *
              <select className={styles.select} required value={studentId} onChange={(e) => { setStudentId(e.target.value); void loadCoursesForStudent(e.target.value); }}>
                <option value="">Sélectionner un étudiant</option>
                {students.filter((student) => Boolean(student.is_demo) === demoMode).map((student) => <option key={student.id} value={student.id}>{student.prenom ? student.prenom + " " : ""}{student.nom} — {classes.find((c) => c.id === student.classe_id)?.nom ?? "—"}</option>)}
              </select>
              <span className={styles.hint}>{students.length} résultat(s) chargés · recherche serveur, 50 par page de résultats</span>
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
        <label className={styles.field}>Recherche
          <input className={styles.input} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom ou matricule" />
        </label>
        <label className={styles.field}>Date
          <input className={styles.input} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className={styles.field}>Classe
          <select className={styles.select} value={filterClass} onChange={(e) => { setPage(1); setFilterClass(e.target.value); }}>
            <option value="">Toutes</option>
            {classes.filter((c) => Boolean(c.is_demo) === demoMode).map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </label>
        <label className={styles.field}>Cours
          <select className={styles.select} value={filterCourse} onChange={(e) => { setPage(1); setFilterCourse(e.target.value); }}>
            <option value="">Tous</option>
            {courses.filter((course) => Boolean(course.is_demo) === demoMode && (!filterClass || course.classe_id === filterClass)).map((course) => <option key={course.id} value={course.id}>{course.nom}</option>)}
          </select>
        </label>
        <label className={styles.field}>Statut
          <select className={styles.select} value={filterStatus} onChange={(e) => { setPage(1); setFilterStatus(e.target.value); }}>
            <option value="">Tous</option><option value="present">Présent</option><option value="absent">Absent</option><option value="retard">Retard</option>
          </select>
        </label>
        <button className={styles.buttonSecondary} type="button" onClick={() => void loadRecords()}>Actualiser</button>
      </div>
      <div className={styles.pagination}>
        <span>{totalRecords} enregistrement(s) · page {page}</span>
        <div className={styles.actions}>
          <button className={styles.buttonSecondary} type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Précédent</button>
          <button className={styles.buttonSecondary} type="button" disabled={page * 50 >= totalRecords} onClick={() => setPage((value) => value + 1)}>Suivant</button>
        </div>
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
  // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronise the view with server-owned data.
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
  const [actor, setActor] = useState("");
  const [entityId, setEntityId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), perPage: "50" });
      if (action) params.set("action", action);
      if (entity) params.set("entity", entity);
      if (actor.trim()) params.set("actor", actor.trim());
      if (entityId.trim()) params.set("entityId", entityId.trim());
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const result = await responseJson<{ events: AuditEvent[]; total: number }>(await fetch(`/api/admin/audit?${params}`, { credentials: "same-origin" }));
      setEvents(result.events); setTotal(result.total);
    } catch (err) { setError(errorLabel(err instanceof Error ? err.message : "journal_indisponible")); }
  }, [page, action, entity, actor, entityId, from, to]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronise the view with server-owned data.
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
        <label className={styles.field}>ID acteur
          <input className={styles.input} value={actor} onChange={(e) => { setPage(1); setActor(e.target.value); }} placeholder="UUID utilisateur" />
        </label>
        <label className={styles.field}>ID entité
          <input className={styles.input} value={entityId} onChange={(e) => { setPage(1); setEntityId(e.target.value); }} placeholder="UUID élément" />
        </label>
        <label className={styles.field}>Du
          <input className={styles.input} type="date" value={from} onChange={(e) => { setPage(1); setFrom(e.target.value); }} />
        </label>
        <label className={styles.field}>Au
          <input className={styles.input} type="date" value={to} onChange={(e) => { setPage(1); setTo(e.target.value); }} />
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
            {events.length === 0 && <tr><td colSpan={6} className={styles.empty}>Aucun événement d’audit trouvé.</td></tr>}
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

export function PasswordManager() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (newPassword.length < 12) {
      setError("Le nouveau mot de passe doit contenir au moins 12 caractères.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("La confirmation ne correspond pas au nouveau mot de passe.");
      return;
    }
    setBusy(true);
    try {
      await responseJson(await fetch("/api/auth/password", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      }));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setNotice("Mot de passe modifié. Utilise le nouveau mot de passe lors de ta prochaine connexion.");
    } catch (err) {
      const value = err instanceof Error ? err.message : "modification_mot_de_passe_impossible";
      setError(value === "mot_de_passe_actuel_incorrect"
        ? "Le mot de passe actuel est incorrect."
        : errorLabel(value));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={styles.manager}>
      <div className={styles.panel}>
        <h2 className={styles.panelTitle}>Sécurité du compte</h2>
        <p className={styles.hint}>Change ton mot de passe sans intervention d’un développeur. Le mot de passe actuel est vérifié avant la modification.</p>
        <form onSubmit={submit}>
          <div className={styles.formGrid}>
            <label className={styles.field}>Mot de passe actuel *
              <input className={styles.input} type="password" autoComplete="current-password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </label>
            <label className={styles.field}>Nouveau mot de passe *
              <input className={styles.input} type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </label>
            <label className={styles.field}>Confirmer le nouveau mot de passe *
              <input className={styles.input} type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </label>
          </div>
          <div className={styles.actions} style={{ marginTop: 12 }}>
            <button className={styles.button} type="submit" disabled={busy || !currentPassword || !newPassword || !confirmPassword}>{busy ? "Modification…" : "Modifier le mot de passe"}</button>
          </div>
        </form>
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {notice && <p className={styles.success} role="status">{notice}</p>}
    </section>
  );
}
