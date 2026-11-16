import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildComptabilite,
  buildComptabiliteCsv,
  libelleSolde,
  validateDepense,
} from "../src/lib/comptabilite.ts";
import type { DepenseRow, RecetteRow } from "../src/lib/comptabilite.ts";

const recettes: RecetteRow[] = [
  { id: "p1", montant_gnf: 500000, recu_le: "2026-11-16" },
  { id: "p2", montant_gnf: 250000, recu_le: "2026-11-20", libelle: "Scolarité T2" },
];

const depenses: DepenseRow[] = [
  { id: "d1", libelle: "Carburant groupe", categorie: "energie", montant_gnf: 120000, date_depense: "2026-11-17" },
  { id: "d2", libelle: "Craies et cahiers", categorie: "fournitures", montant_gnf: 80000, date_depense: "2026-11-18" },
  { id: "d3", libelle: "Prime surveillant", categorie: "salaires", montant_gnf: 300000, date_depense: "2026-11-25" },
];

test("buildComptabilite : totaux recettes / dépenses / solde", () => {
  const r = buildComptabilite({ recettes, depenses });
  assert.equal(r.totaux.recettes_gnf, 750000);
  assert.equal(r.totaux.depenses_gnf, 500000);
  assert.equal(r.totaux.solde_gnf, 250000);
  assert.equal(r.totaux.nb_ecritures, 5);
});

test("buildComptabilite : grand livre trié par date décroissante", () => {
  const r = buildComptabilite({ recettes, depenses });
  assert.deepEqual(
    r.ecritures.map((e) => e.date),
    ["2026-11-25", "2026-11-20", "2026-11-18", "2026-11-17", "2026-11-16"]
  );
  assert.equal(r.ecritures[0].type, "depense");
  assert.equal(r.ecritures.at(-1)?.type, "recette");
});

test("buildComptabilite : filtre période inclusive", () => {
  const r = buildComptabilite({ recettes, depenses }, { from: "2026-11-17", to: "2026-11-20" });
  assert.deepEqual(
    r.ecritures.map((e) => e.date),
    ["2026-11-20", "2026-11-18", "2026-11-17"]
  );
  assert.equal(r.totaux.recettes_gnf, 250000);
  assert.equal(r.totaux.depenses_gnf, 200000);
  assert.equal(r.totaux.solde_gnf, 50000);
});

test("buildComptabilite : dépenses par catégorie, triées décroissant", () => {
  const r = buildComptabilite({ recettes, depenses });
  assert.deepEqual(r.par_categorie, [
    { categorie: "salaires", montant_gnf: 300000 },
    { categorie: "energie", montant_gnf: 120000 },
    { categorie: "fournitures", montant_gnf: 80000 },
  ]);
});

test("buildComptabilite : recette sans libellé → libellé par défaut", () => {
  const r = buildComptabilite({ recettes, depenses: [] });
  assert.equal(r.ecritures.find((e) => e.id === "recette-p1")?.libelle, "Frais de scolarité");
  assert.equal(r.ecritures.find((e) => e.id === "recette-p2")?.libelle, "Scolarité T2");
});

test("buildComptabilite : aucune écriture → solde nul", () => {
  const r = buildComptabilite({ recettes: [], depenses: [] });
  assert.equal(r.totaux.solde_gnf, 0);
  assert.equal(r.ecritures.length, 0);
  assert.deepEqual(r.par_categorie, []);
});

test("buildComptabiliteCsv : en-tête, lignes, BOM, CRLF", () => {
  const r = buildComptabilite({ recettes, depenses });
  const csv = buildComptabiliteCsv(r.ecritures);
  assert.ok(csv.startsWith("\uFEFF"));
  const lines = csv.replace(/^\uFEFF/, "").split("\r\n");
  assert.equal(lines[0], '"date","type","libelle","categorie","montant_gnf"');
  assert.ok(lines.includes('"2026-11-17","depense","Carburant groupe","Énergie","120000"'));
  assert.ok(lines.includes('"2026-11-16","recette","Frais de scolarité","","500000"'));
  assert.equal(lines.length, r.ecritures.length + 1);
});

test("validateDepense : rejette les saisies invalides", () => {
  assert.deepEqual(
    validateDepense({ libelle: "Craies", categorie: "fournitures", montant_gnf: 80000, date_depense: "2026-11-18" }),
    { ok: true }
  );
  assert.deepEqual(validateDepense({ categorie: "fournitures", montant_gnf: 80000, date_depense: "2026-11-18" }), { ok: false, error: "libelle_requis" });
  assert.deepEqual(validateDepense({ libelle: "X", categorie: "fournitures", montant_gnf: 80000, date_depense: "2026-11-18" }), { ok: false, error: "libelle_requis" });
  assert.deepEqual(validateDepense({ libelle: "Craies", categorie: "inconnu", montant_gnf: 80000, date_depense: "2026-11-18" }), { ok: false, error: "categorie_invalide" });
  assert.deepEqual(validateDepense({ libelle: "Craies", categorie: "fournitures", montant_gnf: -1, date_depense: "2026-11-18" }), { ok: false, error: "montant_invalide" });
  assert.deepEqual(validateDepense({ libelle: "Craies", categorie: "fournitures", montant_gnf: 80000, date_depense: "18/11/2026" }), { ok: false, error: "date_invalide" });
});

test("libelleSolde : signe explicite", () => {
  assert.equal(libelleSolde(0), "Équilibré");
  assert.ok(libelleSolde(250000).startsWith("Excédent"));
  assert.ok(libelleSolde(-50000).startsWith("Déficit"));
});
