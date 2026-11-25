/**
 * Store du scanner mobile : orchestration du pointage et file hors ligne.
 * Les écritures locales sont sérialisées afin qu'une synchronisation ne puisse
 * pas écraser un scan ajouté en parallèle.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  dejaEnAttente,
  nouvelleEntree,
  nombreEnAttente,
  nombreEnAttenteAvecCours,
  resumeFile,
  synchroniser,
  type FileItem,
  type FileStore,
} from "../lib/queue";
import type { ScanEtat } from "../lib/scanStatus";
import { pointer, rejouerPointage } from "../services/api";

export type LocalItem = FileItem;
export type ResumeLocal = ReturnType<typeof resumeFile> & { derniereSynchronisation: string | null };

const KEY = "vc.mobile.queue.v1";
const SYNC_KEY = "vc.mobile.sync.v1";

const asyncStore: FileStore = {
  async load() {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("La file locale est illisible.");
    return parsed as FileItem[];
  },
  async save(items) {
    await AsyncStorage.setItem(KEY, JSON.stringify(items));
  },
};

let mutationTail: Promise<void> = Promise.resolve();

function serialiserMutation<T>(work: () => Promise<T>): Promise<T> {
  const result = mutationTail.then(work, work);
  mutationTail = result.then(() => undefined, () => undefined);
  return result;
}

const uid = () =>
  "m-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);

export async function mettreEnAttente(
  codeQr: string,
  selection?: { coursId: string; coursNom: string; salle?: string }
): Promise<ScanEtat> {
  return serialiserMutation(async () => {
    const items = await asyncStore.load();
    const coursId = selection?.coursId ?? "";
    if (dejaEnAttente(items, codeQr, coursId || undefined)) {
      return { kind: "deja_en_attente" };
    }

    const entry: FileItem = {
      ...nouvelleEntree(uid(), {
        code_qr: codeQr,
        cours: coursId,
        salle: selection?.salle,
        at: new Date().toISOString(),
      }),
      cours_nom: selection?.coursNom,
    };
    await asyncStore.save([...items, entry]);
    emitChange();
    return { kind: "hors_ligne", fileId: entry.id };
  });
}

export async function enregistrerScan(
  codeQr: string,
  selection?: { coursId: string; coursNom: string; salle?: string }
): Promise<ScanEtat> {
  const etat = await pointer(codeQr, selection);

  if (etat.kind === "hors_ligne" || etat.kind === "erreur_serveur") {
    return mettreEnAttente(codeQr, selection);
  }

  if (etat.kind === "confirmee" || etat.kind === "doublon") {
    await serialiserMutation(async () => {
      const items = await asyncStore.load();
      const coursId = selection?.coursId ?? "";
      const courseId = etat.coursId ?? coursId;
      const unresolved = items.map((item) =>
        item.etat === "en_attente" && !item.cours && item.code_qr === codeQr.toUpperCase()
          ? {
              ...item,
              cours: courseId,
              cours_nom: etat.cours ?? selection?.coursNom,
              eleve: etat.eleve,
              at: new Date().toISOString(),
              etat: "confirme" as const,
              note: "résolu après validation serveur lors d'un nouveau scan",
            }
          : item
      );
      const alreadyResolved = unresolved.some(
        (item) =>
          item.etat === "confirme" &&
          item.code_qr === codeQr.toUpperCase() &&
          item.cours === courseId
      );

      if (!alreadyResolved && etat.kind === "confirmee") {
        unresolved.push({
          ...nouvelleEntree(uid(), {
            code_qr: codeQr,
            cours: courseId,
            salle: selection?.salle,
            at: new Date().toISOString(),
          }),
          etat: "confirme",
          eleve: etat.eleve,
          cours_nom: etat.cours ?? selection?.coursNom,
        });
      }

      await asyncStore.save(unresolved);
      emitChange();
    });
  }

  return etat;
}

export async function synchroniserFile(): Promise<number> {
  return serialiserMutation(async () => {
    const items = await asyncStore.load();
    if (nombreEnAttenteAvecCours(items) === 0) return 0;

    const { items: next, synchronises } = await synchroniser(items, rejouerPointage);
    await asyncStore.save(next);
    await AsyncStorage.setItem(SYNC_KEY, new Date().toISOString());
    emitChange();
    return synchronises;
  });
}

export async function enAttente(): Promise<number> {
  return nombreEnAttente(await asyncStore.load());
}

export async function enAttenteAvecCours(): Promise<number> {
  return nombreEnAttenteAvecCours(await asyncStore.load());
}

export async function resumeLocal(): Promise<ResumeLocal> {
  const items = await asyncStore.load();
  const derniereSynchronisation = await AsyncStorage.getItem(SYNC_KEY);
  return { ...resumeFile(items), derniereSynchronisation };
}

export async function historique(): Promise<FileItem[]> {
  const items = await asyncStore.load();
  return items.slice().reverse().slice(0, 20);
}

const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

export function onFileChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
