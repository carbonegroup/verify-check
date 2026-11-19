/**
 * Schémas de validation Zod pour les API routes.
 * Centralise la validation d'entrée (request body, query params).
 */

import { z } from "zod";

/** Schéma de connexion admin. */
export const loginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

/** Schéma pointage scan. */
export const scanSchema = z.object({
  code_qr: z.string().min(1, "Code QR requis").max(64, "Code QR trop long"),
  salle: z.string().max(32).optional(),
  cours: z.string().uuid("ID cours invalide").optional(),
});

/** Schéma enregistrement règlement (frais scolarité). */
export const reglementSchema = z.object({
  student_id: z.string().uuid("ID élève invalide"),
  fee_id: z.string().uuid("ID frais invalide"),
  montant_gnf: z.number().int().positive("Montant invalide"),
  recu_le: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide (YYYY-MM-DD)"),
  note: z.string().max(500).optional(),
});

/** Schéma enregistrement dépense (comptabilité). */
export const depenseSchema = z.object({
  libelle: z.string().min(2, "Libellé trop court").max(200, "Libellé trop long"),
  categorie: z.enum([
    "salaires",
    "fournitures",
    "entretien",
    "transport",
    "energie",
    "loyer",
    "autre",
  ]),
  montant_gnf: z.number().int().positive("Montant invalide"),
  date_depense: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide (YYYY-MM-DD)"),
  note: z.string().max(500).optional(),
});

/** Schéma paramètres dashboard (query params). */
export const dashboardQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide (YYYY-MM-DD)").optional(),
  classe: z.string().uuid().optional(),
  cours: z.string().uuid().optional(),
  eleve: z.string().uuid().optional(),
});

/** Schéma paramètres export absences (query params). */
export const exportAbsencesQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide (YYYY-MM-DD)").optional(),
  classe: z.string().uuid().optional(),
  cours: z.string().uuid().optional(),
});

/** Schéma paramètres scolarité (query params). */
export const scolariteQuerySchema = z.object({
  classe: z.string().uuid().optional(),
  statut: z.enum(["regle", "partiel", "impaye", "sans-frais"]).optional(),
});

/** Schéma paramètres comptabilité (query params). */
export const comptabiliteQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide (YYYY-MM-DD)").optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide (YYYY-MM-DD)").optional(),
});

/** Schéma validation code QR pour génération cartes. */
export const qrCodeQuerySchema = z.object({
  code: z.string().min(1, "Code requis").max(64, "Code trop long"),
});

/** Type helper pour extraire le type inféré d'un schéma. */
export type SchemaInfer<T extends z.ZodTypeAny> = z.infer<T>;