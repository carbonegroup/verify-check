import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const siteUrl = "https://verify-check-one.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "VerifyCheck — Présence scolaire par QR code",
    template: "%s | VerifyCheck",
  },
  description: "VerifyCheck accompagne les établissements scolaires dans le suivi des présences par carte QR code et la consultation des présences par classe et par cours.",
  applicationName: "VerifyCheck",
  openGraph: {
    type: "website",
    locale: "fr_GN",
    siteName: "VerifyCheck",
    title: "VerifyCheck — Présence scolaire par QR code",
    description: "VerifyCheck accompagne les établissements scolaires dans le suivi des présences par carte QR code et la consultation des présences par classe et par cours.",
    url: siteUrl,
  },
  twitter: {
    card: "summary",
    title: "VerifyCheck — Présence scolaire par QR code",
    description: "VerifyCheck accompagne les établissements scolaires dans le suivi des présences par carte QR code et la consultation des présences par classe et par cours.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
