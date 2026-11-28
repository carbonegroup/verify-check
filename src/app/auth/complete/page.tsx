import type { Metadata } from "next";
import AuthCompleteClient from "./AuthCompleteClient";
import styles from "@/app/login/login.module.css";

export const metadata: Metadata = {
  title: "Finalisation de connexion",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AuthCompletePage() {
  return (
    <main className={styles.page}>
      <AuthCompleteClient />
    </main>
  );
}
