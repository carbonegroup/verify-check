import { test } from "node:test";
import assert from "node:assert/strict";
import {
  nouvelleEntree,
  dejaEnAttente,
  nombreEnAttente,
  nombreEnAttenteAvecCours,
  resumeFile,
  synchroniser,
  estRejetDefinitif,
  type FileItem,
  type FileStore,
} from "../src/lib/queue.ts";

function storeVirtuel(initial: FileItem[] = []): { store: FileStore; items: FileItem[] } {
  const items = initial;
  return {
    items,
    store: {
      async load() { return items.slice(); },
      async save(next) { items.length = 0; items.push(...next); },
    },
  };
}

const scan = { code_qr: "vc-001", cours: "co-1", salle: "B12", at: "2026-11-14T08:05:00Z" };

test("nouvelleEntree normalise le QR et démarre en attente", () => {
  const entry = nouvelleEntree("id-1", scan);
  assert.equal(entry.code_qr, "VC-001");
  assert.equal(entry.etat, "en_attente");
});

test("dejaEnAttente empêche les doublons locaux par code et cours", () => {
  const entry = nouvelleEntree("id-1", scan);
  assert.ok(dejaEnAttente([entry], "vc-001", "co-1"));
  assert.ok(!dejaEnAttente([entry], "vc-002", "co-1"));
  assert.ok(!dejaEnAttente([entry], "vc-001", "co-2"));
  assert.ok(!dejaEnAttente([{ ...entry, etat: "confirme" }], "vc-001", "co-1"));
});

test("résumé distingue les entrées synchronisables des scans sans cours", () => {
  const a = nouvelleEntree("id-1", scan);
  const b = nouvelleEntree("id-2", { ...scan, code_qr: "VC-002", cours: "" });
  const c = { ...nouvelleEntree("id-3", scan), etat: "confirme" as const };
  const items = [a, b, c];
  assert.equal(nombreEnAttente(items), 2);
  assert.equal(nombreEnAttenteAvecCours(items), 1);
  assert.deepEqual(resumeFile(items), {
    total: 3,
    enAttente: 2,
    synchronisables: 1,
    confirmes: 1,
    rejetes: 0,
    derniereActivite: scan.at,
  });
});

test("synchroniser : doublon serveur = confirmé", async () => {
  const entry = nouvelleEntree("id-1", scan);
  const result = await synchroniser([entry], async () => "doublon");
  assert.equal(result.synchronises, 1);
  assert.equal(result.items[0].etat, "confirme");
  assert.ok(result.items[0].note?.includes("doublon"));
});

test("synchroniser : rejet définitif reste visible comme rejeté", async () => {
  const entry = nouvelleEntree("id-1", scan);
  const result = await synchroniser([entry], async () => "rejete_definitif");
  assert.equal(result.synchronises, 0);
  assert.equal(result.items[0].etat, "rejete");
});

test("synchroniser : perte réseau conserve l'entrée et arrête la file", async () => {
  const a = nouvelleEntree("id-1", scan);
  const b = nouvelleEntree("id-2", { ...scan, code_qr: "VC-002" });
  let calls = 0;
  const result = await synchroniser([a, b], async () => { calls++; return "reessayer"; });
  assert.equal(result.synchronises, 0);
  assert.equal(calls, 1);
  assert.equal(result.items[0].essais, 1);
  assert.equal(result.items[0].etat, "en_attente");
  assert.equal(result.items[1].essais, 0);
});

test("un scan hors ligne sans cours n'est jamais attribué à une séance ultérieure", async () => {
  const unresolved = nouvelleEntree("id-unresolved", {
    code_qr: "VC-UNRESOLVED", cours: "", at: "2026-11-23T08:05:00Z",
  });
  let calls = 0;
  const result = await synchroniser([unresolved], async () => { calls++; return "confirme"; });
  assert.equal(calls, 0);
  assert.equal(result.synchronises, 0);
  assert.equal(result.items[0].etat, "en_attente");
});

test("les entrées déjà confirmées ou rejetées ne sont pas rejouées", async () => {
  const confirmed: FileItem = { ...nouvelleEntree("id-1", scan), etat: "confirme" };
  const rejected: FileItem = { ...nouvelleEntree("id-2", scan), etat: "rejete" };
  const pending = nouvelleEntree("id-3", { ...scan, code_qr: "VC-003" });
  let calls = 0;
  const result = await synchroniser([confirmed, rejected, pending], async () => {
    calls++;
    return "confirme";
  });
  assert.equal(calls, 1);
  assert.equal(result.synchronises, 1);
});

test("estRejetDefinitif : seul qr_invalide est définitif", () => {
  assert.ok(estRejetDefinitif("qr_invalide"));
  assert.ok(!estRejetDefinitif("cours_pas_actif"));
  assert.ok(!estRejetDefinitif("pas_de_cours"));
  assert.ok(!estRejetDefinitif("salle_invalide"));
  assert.ok(!estRejetDefinitif("doublon"));
  assert.ok(!estRejetDefinitif(undefined));
});

test("FileStore virtuel conserve les entrées", async () => {
  const store = storeVirtuel();
  await store.store.save([nouvelleEntree("id-1", scan)]);
  assert.equal((await store.store.load())[0].id, "id-1");
});
