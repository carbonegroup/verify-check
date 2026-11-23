/**
 * File d'attente hors ligne du scanner mobile — logique pure (testée sans RN).
 * Le stockage persistant (AsyncStorage) est injecté : ce module ne sait rien
 * de React Native. Chaque entrée a un identifiant unique ; le doublon serveur
 * est un CONFIRMEMENT, un rejet définitif est marqué `rejete`.
 */

export type FileItem = {
  id: string;
  code_qr: string;
  cours: string;
  salle?: string;
  /** Heure locale ISO du scan (au moment du geste agent). */
  at: string;
  etat: "en_attente" | "confirme" | "rejete";
  note?: string;
  essais: number;
};

export type FileStore = {
  load(): Promise<FileItem[]>;
  save(items: FileItem[]): Promise<void>;
};

/** Rejets métier définitifs (jamais réessayables).
 * Aligné sur le contrat serveur (maintenance cycle 1) : seul `qr_invalide`
 * est définitif — un pointage rejeté pour timing (pas_de_cours, salle…)
 * reste EN ATTENTE et est rejoué à la synchronisation, jamais supprimé. */
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

/** Anti-doublon local : ce code est-il déjà EN ATTENTE pour ce cours ? */
export function dejaEnAttente(items: FileItem[], codeQr: string, cours: string): boolean {
  const code = codeQr.toUpperCase();
  return items.some(
    (i) => i.etat === "en_attente" && i.code_qr === code && i.cours === cours
  );
}

/** Charge, puis applique une transformation pure sur la file et la persiste. */
export async function mettreAJour(
  store: FileStore,
  transform: (items: FileItem[]) => FileItem[]
): Promise<FileItem[]> {
  const items = transform(await store.load());
  await store.save(items);
  return items;
}

/** Compte des pointages EN ATTENTE (badge réseau de l'UI). */
export function nombreEnAttente(items: FileItem[]): number {
  return items.filter((i) => i.etat === "en_attente").length;
}

/**
 * Synchronise la file : rejoue chaque pointage EN ATTENTE via `replay`.
 * Règles précises (alignées sur le contrat serveur) :
 * - `confirme` (201) ou `doublon` serveur → CONFIRMÉ (badge vert) ;
 * - rejet définitif → REJETÉ (seul `qr_invalide` est définitif,
 *   les rejets de timing restent EN ATTENTE et sont rejoués) ;
 * - erreur réseau/perte → reste EN ATTENTE, essais+1, on s'arrête pas
 *   brutalement : on traite séquentiellement et on s'arrête seulement
 *   si la réseau tombe complètement (pas de réponse serveur).
 * - La file est JAMAIS nettoyée arbitrairement : chaque entrée conservée
 *   jusqu'à ce qu'elle soit effectivement traitée par le serveur.
 */
export async function synchroniser(
  items: FileItem[],
  replay: (item: FileItem) => Promise<"confirme" | "doublon" | "rejete_definitif" | "reessayer">
): Promise<{ items: FileItem[]; synchronises: number }> {
  let synchronises = 0;
  let blocked = false;
  const out: FileItem[] = [];
  // On traite TOUTES les items, même s'il y en a beaucoup.
  // On s'arrête seulement si le replay rejoue `reessayer` ET que c'est la
  // première erreur (pour éviter les boucles infinies en cas de réseau mort).
  let firstReessayer = true;
  for (const item of items) {
    if (item.etat !== "en_attente" || blocked) {
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
      firstReessayer = true; // reset after success
    } else if (result === "rejete_definitif") {
      out.push({ ...item, etat: "rejete" });
      firstReessayer = true;
    } else {
      // reessayer : le pointage reste EN ATTENTE
      out.push({ ...item, essais: item.essais + 1 });
      // On ne bloque PAS la file : on continue avec le prochain item.
      // On ne set blocked que si c'est le premier reessayer consécutif
      // (protection contre les boucles infinies si le réseau est mort).
      if (firstReessayer) {
        blocked = true;
        firstReessayer = false;
      }
    }
  }
  return { items: out, synchronises };
}

/** Le rejet métier renvoyé par le serveur est-il définitif ? */
export function estRejetDefinitif(erreur?: string): boolean {
  return REJETS_DEFINITIFS.has(erreur ?? "");
}
