/**
 * Mapping d'une réponse de `POST /api/scan` vers un état métier affichable.
 * Règle absolue : aucun état « confirmé » tant que le serveur n'a pas répondu.
 * Partagé entre l'app mobile et testé sans React Native (node:test).
 */

export type ScanApiStatus = 200 | 201 | 400 | 401 | 403 | 404 | 409 | 500 | number;

export type ScanEtat =
  | { kind: "previsualisation"; eleve?: string; classe?: string; cours?: string; coursId?: string }
  | { kind: "confirmee"; eleve?: string; classe?: string; cours?: string; coursId?: string }
  | { kind: "doublon"; eleve?: string; classe?: string; cours?: string; coursId?: string }
  | { kind: "qr_invalide" }
  | { kind: "pas_de_cours"; heure?: string; eleve?: string; classe?: string }
  | { kind: "cours_ambigu"; eleve?: string; classe?: string; candidates: Array<{ id: string; nom: string; salle: string | null; heure_debut?: string; heure_fin?: string }> }
  | { kind: "salle_invalide"; salle?: string; eleve?: string; classe?: string }
  | { kind: "session_expiree" }
  | { kind: "acces_refuse" }
  | { kind: "erreur_requete" }
  | { kind: "erreur_serveur" }
  | { kind: "hors_ligne"; fileId: string }
  | { kind: "deja_en_attente" };

export type ScanApiBody = {
  ok?: boolean;
  preview?: boolean;
  error?: string;
  eleve?: string;
  classe?: string;
  cours?: string;
  cours_id?: string;
  heure?: string;
  salle?: string;
  candidates?: Array<{ id: string; nom: string; salle: string | null; heure_debut?: string; heure_fin?: string }>;
};

/** Rejets métier définitifs en DIRECT : jamais mises en file d'attente
 * (l'agent voit le résultat immédiatement). À la resynchronisation, la règle
 * est différente (voir lib/queue.ts) : seul `qr_invalide` est rejeté, les
 * rejets de timing restent EN ATTENTE et sont rejoués. */
const REJETS_DEFINITIFS = new Set([
  "qr_invalide",
  "pas_de_cours",
  "cours_ambigu",
  "salle_invalide",
  "cours_pas_actif",
]);

export function mapScanResponse(
  httpStatus: ScanApiStatus,
  body: ScanApiBody | null
): ScanEtat {
  const err = body?.error;
  if (httpStatus === 200 && body?.preview === true) {
    return { kind: "previsualisation", eleve: body.eleve, classe: body.classe, cours: body.cours, coursId: body.cours_id };
  }
  if (httpStatus === 201) {
    return { kind: "confirmee", eleve: body?.eleve, classe: body?.classe, cours: body?.cours, coursId: body?.cours_id };
  }
  if (err === "doublon") return { kind: "doublon", eleve: body?.eleve, classe: body?.classe, cours: body?.cours, coursId: body?.cours_id };
  if (err === "qr_invalide") return { kind: "qr_invalide" };
  if (err === "pas_de_cours") return { kind: "pas_de_cours", heure: body?.heure, eleve: body?.eleve, classe: body?.classe };
  if (err === "cours_ambigu") return { kind: "cours_ambigu", eleve: body?.eleve, classe: body?.classe, candidates: body?.candidates ?? [] };
  if (err === "salle_invalide" || err === "cours_pas_actif") {
    return { kind: "salle_invalide", salle: body?.salle, eleve: body?.eleve, classe: body?.classe };
  }
  if (httpStatus === 401 || err === "session_requise" || err === "session_invalide") {
    return { kind: "session_expiree" };
  }
  if (httpStatus === 403) return { kind: "acces_refuse" };
  if (httpStatus === 400 || httpStatus === 404) return { kind: "erreur_requete" };
  return { kind: "erreur_serveur" };
}

/** Faut-il mettre le pointage en file d'attente hors ligne après cette réponse ? */
export function doitMettreEnFile(etat: ScanEtat): boolean {
  if (
    etat.kind === "previsualisation" ||
    etat.kind === "confirmee" ||
    etat.kind === "doublon" ||
    etat.kind === "session_expiree" ||
    etat.kind === "acces_refuse" ||
    etat.kind === "erreur_requete" ||
    etat.kind === "hors_ligne" ||
    etat.kind === "deja_en_attente"
  ) {
    return false;
  }
  if (REJETS_DEFINITIFS.has(etat.kind)) return false;
  // erreur_serveur → en file : le pointage reste EN ATTENTE, réessayable,
  // jamais perdu ni jamais présenté comme confirmé.
  return true;
}
