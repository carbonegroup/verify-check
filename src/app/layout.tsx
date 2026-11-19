import type { Metadata } from "next";
import { validateEnv } from "@/env";
import "./globals.css";

// Validation fail-fast des variables d'environnement au démarrage
validateEnv();

export const metadata: Metadata = {
  title: "VerifyCheck — Présence scolaire",
  description: "Suivi de présence par QR code",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
