import { test } from "node:test";
import assert from "node:assert/strict";
import {
  loginSchema,
  scanSchema,
  reglementSchema,
  depenseSchema,
  dashboardQuerySchema,
} from "../src/lib/validation.ts";

test("loginSchema valide email + password", () => {
  const result = loginSchema.safeParse({ email: "admin@test.com", password: "secret" });
  assert.ok(result.success);
});

test("loginSchema rejette email invalide", () => {
  const result = loginSchema.safeParse({ email: "pas-un-email", password: "secret" });
  assert.ok(!result.success);
});

test("loginSchema rejette password manquant", () => {
  const result = loginSchema.safeParse({ email: "admin@test.com", password: "" });
  assert.ok(!result.success);
});

test("scanSchema valide code_qr requis", () => {
  const result = scanSchema.safeParse({ code_qr: "VC-001" });
  assert.ok(result.success);
});

test("scanSchema rejette code_qr vide", () => {
  const result = scanSchema.safeParse({ code_qr: "" });
  assert.ok(!result.success);
});

test("scanSchema accepte salle optionnelle", () => {
  const result = scanSchema.safeParse({ code_qr: "VC-001", salle: "B12" });
  assert.ok(result.success);
});

test("reglementSchema valide saisie complète", () => {
  const result = reglementSchema.safeParse({
    student_id: "123e4567-e89b-12d3-a456-426614174000",
    fee_id: "123e4567-e89b-12d3-a456-426614174001",
    montant_gnf: 500000,
    recu_le: "2026-11-16",
    note: "Reçu #123",
  });
  assert.ok(result.success);
});

test("reglementSchema rejette montant négatif", () => {
  const result = reglementSchema.safeParse({
    student_id: "123e4567-e89b-12d3-a456-426614174000",
    fee_id: "123e4567-e89b-12d3-a456-426614174001",
    montant_gnf: -100,
    recu_le: "2026-11-16",
  });
  assert.ok(!result.success);
});

test("reglementSchema rejette date invalide", () => {
  const result = reglementSchema.safeParse({
    student_id: "123e4567-e89b-12d3-a456-426614174000",
    fee_id: "123e4567-e89b-12d3-a456-426614174001",
    montant_gnf: 500000,
    recu_le: "16/11/2026",
  });
  assert.ok(!result.success);
});

test("depenseSchema valide saisie complète", () => {
  const result = depenseSchema.safeParse({
    libelle: "Carburant",
    categorie: "energie",
    montant_gnf: 120000,
    date_depense: "2026-11-17",
  });
  assert.ok(result.success);
});

test("depenseSchema rejette catégorie invalide", () => {
  const result = depenseSchema.safeParse({
    libelle: "Test",
    categorie: "invalide",
    montant_gnf: 1000,
    date_depense: "2026-11-17",
  });
  assert.ok(!result.success);
});

test("dashboardQuerySchema valide date optionnelle", () => {
  const result = dashboardQuerySchema.safeParse({ date: "2026-11-13", classe: "123e4567-e89b-12d3-a456-426614174000" });
  assert.ok(result.success);
});

test("dashboardQuerySchema rejette date invalide", () => {
  const result = dashboardQuerySchema.safeParse({ date: "13/11/2026" });
  assert.ok(!result.success);
});