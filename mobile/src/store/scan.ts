/**
 * Store du scanner mobile : orchestration du pointage et file hors ligne.
 * La logique de synchronisation pure reste dans lib/queue.ts.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  dejaEnAttente,
  nouvelleEntree,
  nombreEnAttente,
  synchroniser,
  type FileItem,
  type FileStore,
} from "../lib/queue";
import type { ScanEtat } from "../lib/scanStatus";
import { pointer, rejouerPointage } from "../services/api";

export type LocalItem = FileItem;

const KEY = "vc.mobile.queue.v1";

const asyncStore: FileStore = {
  async load() {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as FileItem[]) : [];
    } catch {
      return [];
    }
  },
  async save(items) {
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      // En cas de quota, le pointage serveur reste valable mais peut manquer
      // dans l’historique local de cet appareil.
    }
  },
};

const uid = () =>
  "m-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);

export async function mettreEnAttente(
  codeQr: string,
  selection?: { coursId: string; coursNom: string; salle?: string }
): Promise<ScanEtat> {
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
}

export async function enregistrerScan(
  codeQr: string,
  selection?: { coursId: string; coursNom: string; salle?: string }
): Promise<ScanEtat> {
  const etat = await pointer(codeQr, selection);
  const items = await asyncStore.load();
  const coursId = selection?.coursId ?? "";

  if (etat.kind === "hors_ligne" || etat.kind === "erreur_serveur") {
    return mettreEnAttente(codeQr, selection);
  }

  // L'historique doit conserver aussi les pointages confirmés en ligne.
  // Un doublon serveur n'est pas un nouveau pointage et n'ajoute donc pas
  // une seconde ligne au registre local.
  if (etat.kind === "confirmee" || etat.kind === "doublon") {
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
      (item) => item.etat === "confirme" && item.code_qr === codeQr.toUpperCase() && item.cours === courseId
    );
    if (!alreadyResolved && etat.kind === "confirmee") {
      const entry: FileItem = {
        ...nouvelleEntree(uid(), {
          code_qr: codeQr,
          cours: courseId,
          salle: selection?.salle,
          at: new Date().toISOString(),
        }),
        etat: "confirme",
        eleve: etat.eleve,
        cours_nom: etat.cours ?? selection?.coursNom,
      };
      unresolved.push(entry);
    }
    await asyncStore.save(unresolved);
    emitChange();
  }

  return etat;
}

export async function synchroniserFile(): Promise<number> {
  const items = await asyncStore.load();
  if (nombreEnAttente(items) === 0) return 0;
  const { items: next, synchronises } = await synchroniser(items, rejouerPointage);
  await asyncStore.save(next);
  emitChange();
  return synchronises;
}

export async function enAttente(): Promise<number> {
  return nombreEnAttente(await asyncStore.load());
}

export async function historique(): Promise<FileItem[]> {
  const items = await asyncStore.load();
  return items.slice().reverse().slice(0, 20);
}

const listeners = new Set<() => void>();
function emitChange() {
  listeners.forEach((fn) => fn());
}
export function onFileChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
