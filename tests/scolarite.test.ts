import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildScolarite,
  buildScolariteCsv,
  formatGnf,
  isReglementDuplicate,
  statutFrais,
  validateReglement,
} from "../src/lib/scolarite.ts";
import type { FraisRow, ReglementRow } from "../src/lib/scolarite.ts";

const classes = [
  { id: "cl-1", nom: "10e A" },
  { id: "cl-2", nom: "11e B" },
];

// cl-1 : 500 000 + 250 000 = 750 000 attendus ; cl-2 : 600 000
const frais: FraisRow[] = [
  { id: "fee-1", classe_id: "cl-1", libelle: "Scolarité T1", annee_scolaire: "2026-2027", montant_gnf: 500000 },
  { id: "fee-2", classe_id: "cl-1", libelle: "Scolarité T2", annee_scolaire: "2026-2027", montant_gnf: 250000 },
  { id: "fee-3", classe_id: "cl-2", libelle: "Scolarité T1", annee_scolaire: "2026-2027", montant_gnf: 600000 },
];

const eleves = [
  { id: "st-1", nom: "Alpha Barry", classe_id: "cl-1" },
  { id: "st-2", nom: "Fatou Camara", classe_id: "cl-1" },
  { id: "st-3", nom: "Ibrahima Diallo", classe_id: "cl-2" },
];

function reg(id: string, student_id: string, fee_id: string, montant_gnf: number, recu_le = "2026-11-16"): ReglementRow {
  return { id, student_id, fee_id, montant_gnf, recu_le };
}

function base(reglements: ReglementRow[] = []) {
  return { classes, eleves, frais, reglements };
}

test("statutFrais : règle les 4 cas", () => {
  assert.equal(statutFrais(0, 0), "sans-frais");
  assert.equal(statutFrais(0, 5000), "sans-frais");
  assert.equal(statutFrais(1000, 1000), "regle");
  assert.equal(statutFrais(1000, 1500), "regle");
  assert.equal(statutFrais(1000, 400), "partiel");
  assert.equal(statutFrais(1000, 0), "impaye");
});

test("buildScolarite : attendu = somme des frais de la classe, regle = somme des règlements de l'élève", () => {
  const r = buildScolarite(base([reg("p1", "st-1", "fee-1", 500000)]));
  const alpha = r.lignes.find((l) => l.eleve_id === "st-1");
  assert.equal(alpha?.attendu_gnf, 750000);
  assert.equal(alpha?.regle_gnf, 500000);
  assert.equal(alpha?.solde_gnf, 250000);
  assert.equal(alpha?.statut, "partiel");

  const fatou = r.lignes.find((l) => l.eleve_id === "st-2");
  assert.equal(fatou?.regle_gnf, 0);
  assert.equal(fatou?.statut, "impaye");

  const ibrahima = r.lignes.find((l) => l.eleve_id === "st-3");
  assert.equal(ibrahima?.attendu_gnf, 600000);
  assert.equal(ibrahima?.statut, "impaye");
});

test("buildScolarite : un règlement complet → statut réglé", () => {
  const r = buildScolarite(
    base([reg("p1", "st-1", "fee-1", 500000), reg("p2", "st-1", "fee-2", 250000)])
  );
  const alpha = r.lignes.find((l) => l.eleve_id === "st-1");
  assert.equal(alpha?.statut, "regle");
  assert.equal(alpha?.solde_gnf, 0);
});

test("buildScolarite : trop-perçu → solde négatif, statut réglé", () => {
  const r = buildScolarite(base([reg("p1", "st-1", "fee-1", 800000)]));
  const alpha = r.lignes.find((l) => l.eleve_id === "st-1");
  assert.equal(alpha?.solde_gnf, -50000);
  assert.equal(alpha?.statut, "regle");
});

test("buildScolarite : filtre classe", () => {
  const r = buildScolarite(base(), { classe: "cl-2" });
  assert.deepEqual(
    r.lignes.map((l) => l.eleve_id),
    ["st-3"]
  );
});

test("buildScolarite : filtre statut", () => {
  const r = buildScolarite(base([reg("p1", "st-1", "fee-1", 500000)]), { statut: "impaye" });
  assert.deepEqual(
    r.lignes.map((l) => l.eleve_id).sort(),
    ["st-2", "st-3"]
  );
});

test("buildScolarite : résumé par classe (attendu, réglé, taux)", () => {
  const r = buildScolarite(base([reg("p1", "st-1", "fee-1", 500000)]));
  const cl1 = r.par_classe.find((c) => c.classe_id === "cl-1");
  assert.equal(cl1?.eleves, 2);
  assert.equal(cl1?.attendu_gnf, 1500000); // 750 000 × 2 élèves
  assert.equal(cl1?.regle_gnf, 500000);
  assert.equal(cl1?.solde_gnf, 1000000);
  assert.ok(Math.abs((cl1?.taux ?? 0) - 500000 / 1500000) < 1e-9);
});

test("buildScolarite : totaux", () => {
  const r = buildScolarite(base([reg("p1", "st-1", "fee-1", 500000)]));
  assert.equal(r.totaux.eleves, 3);
  assert.equal(r.totaux.attendu_gnf, 1500000 + 600000);
  assert.equal(r.totaux.regle_gnf, 500000);
  assert.equal(r.totaux.solde_gnf, 1600000);
});

test("buildScolarite : classe sans frais → aucun frais attendu", () => {
  const r = buildScolarite({ ...base(), frais: [] });
  assert.ok(r.lignes.every((l) => l.statut === "sans-frais" && l.attendu_gnf === 0));
});

test("buildScolariteCsv : en-tête, lignes, BOM et CRLF", () => {
  const r = buildScolarite(base([reg("p1", "st-1", "fee-1", 500000)]));
  const csv = buildScolariteCsv(r.lignes);
  assert.ok(csv.startsWith("\uFEFF"));
  const lines = csv.replace(/^\uFEFF/, "").split("\r\n");
  assert.equal(lines[0], '"eleve","classe","attendu_gnf","regle_gnf","solde_gnf","statut"');
  assert.ok(lines.includes('"Alpha Barry","10e A","750000","500000","250000","PARTIEL"'));
  assert.equal(lines.length, r.lignes.length + 1);
});

test("isReglementDuplicate : même élève + frais + montant + date", () => {
  const existing = [reg("p1", "st-1", "fee-1", 500000, "2026-11-16")];
  assert.ok(isReglementDuplicate(existing, { student_id: "st-1", fee_id: "fee-1", montant_gnf: 500000, recu_le: "2026-11-16" }));
  assert.ok(!isReglementDuplicate(existing, { student_id: "st-1", fee_id: "fee-1", montant_gnf: 500000, recu_le: "2026-11-17" }));
  assert.ok(!isReglementDuplicate(existing, { student_id: "st-2", fee_id: "fee-1", montant_gnf: 500000, recu_le: "2026-11-16" }));
});

test("validateReglement : rejette les saisies invalides", () => {
  assert.deepEqual(validateReglement({ student_id: "st-1", fee_id: "fee-1", montant_gnf: 5000, recu_le: "2026-11-16" }), { ok: true });
  assert.deepEqual(validateReglement({ fee_id: "fee-1", montant_gnf: 5000, recu_le: "2026-11-16" }), { ok: false, error: "eleve_requis" });
  assert.deepEqual(validateReglement({ student_id: "st-1", montant_gnf: 5000, recu_le: "2026-11-16" }), { ok: false, error: "frais_requis" });
  assert.deepEqual(validateReglement({ student_id: "st-1", fee_id: "fee-1", montant_gnf: 0, recu_le: "2026-11-16" }), { ok: false, error: "montant_invalide" });
  assert.deepEqual(validateReglement({ student_id: "st-1", fee_id: "fee-1", montant_gnf: 5000, recu_le: "16/11/2026" }), { ok: false, error: "date_invalide" });
});

test("formatGnf : milliers séparés + suffixe", () => {
  assert.ok(formatGnf(750000).startsWith("750"));
  assert.ok(formatGnf(750000).endsWith("GNF"));
});
