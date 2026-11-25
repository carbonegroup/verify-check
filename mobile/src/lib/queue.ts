/**
 * File d'attente hors ligne du scanner mobile — logique pure.
 * Les données en attente ne sont jamais présentées comme des présences validées.
 */

export type FileItem = {
  id: string;
  code_qr: string;
  cours: string;
  salle?: string;
  at: string;
  etat: "en_attente" | "confirme" | "rejete";
  note?: string;
  eleve?: string;
  cours_nom?: string;
  essais: number;
};

export type FileStore = {
  load(): Promise<FileItem[]>;
  save(items: FileItem[]): Promise<void>;
};

const REJETS_DEFINITIFS = new Set(["qr_invalide"]);

export function nouvelleEntree(
  id: string,
  scan: { code_qr: string; cours: string; salle?: string; at: string }
): FileItem {
  return {
    id,
    code_qr: scan.code_qr.toUpperCase(),
    cours: scan.cours,
    salle: scan.salle,
    at: scan.at,
    etat: "en_attente",
    essais: 0,
  };
}

export function dejaEnAttente(items: FileItem[], codeQr: string, cours?: string): boolean {
  const code = codeQr.toUpperCase();
  return items.some(
    (item) =>
      item.etat === "en_attente" &&
      item.code_qr === code &&
      (!cours || !item.cours || item.cours === cours)
  );
}

export async function mettreAJour(
  store: FileStore,
  transform: (items: FileItem[]) => FileItem[]
): Promise<FileItem[]> {
  const items = transform(await store.load());
  await store.save(items);
  return items;
}

export function nombreEnAttente(items: FileItem[]): number {
  return items.filter((item) => item.etat === "en_attente").length;
}

export function nombreEnAttenteAvecCours(items: FileItem[]): number {
  return items.filter((item) => item.etat === "en_attente" && Boolean(item.cours)).length;
}

export function resumeFile(items: FileItem[]) {
  return {
    total: items.length,
    enAttente: nombreEnAttente(items),
    synchronisables: nombreEnAttenteAvecCours(items),
    confirmes: items.filter((item) => item.etat === "confirme").length,
    rejetes: items.filter((item) => item.etat === "rejete").length,
    derniereActivite: items.reduce<string | null>(
      (latest, item) => (!latest || item.at > latest ? item.at : latest),
      null
    ),
  };
}

/**
 * Rejoue séquentiellement les éléments qui possèdent déjà un cours attribué.
 * Les scans sans cours restent en attente : aucun cours ne leur est inventé.
 */
export async function synchroniser(
  items: FileItem[],
  replay: (item: FileItem) => Promise<"confirme" | "doublon" | "rejete_definitif" | "reessayer">
): Promise<{ items: FileItem[]; synchronises: number }> {
  let synchronises = 0;
  let blocked = false;
  const out: FileItem[] = [];

  for (const item of items) {
    if (item.etat !== "en_attente" || !item.cours || blocked) {
      out.push(item);
      continue;
    }

    const result = await replay(item);
    if (result === "confirme" || result === "doublon") {
      out.push({
        ...item,
        etat: "confirme",
        note: result === "doublon" ? "doublon confirmé par le serveur" : "",
      });
      synchronises++;
    } else if (result === "rejete_definitif") {
      out.push({ ...item, etat: "rejete" });
    } else {
      out.push({ ...item, essais: item.essais + 1 });
      blocked = true;
    }
  }

  return { items: out, synchronises };
}

export function estRejetDefinitif(erreur?: string): boolean {
  return REJETS_DEFINITIFS.has(erreur ?? "");
}
