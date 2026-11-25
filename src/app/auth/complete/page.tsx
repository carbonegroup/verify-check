import AuthCompleteClient from "./AuthCompleteClient";
import styles from "@/app/login/login.module.css";

export default function AuthCompletePage() {
  return (
    <main className={styles.page}>
      <AuthCompleteClient />
    </main>
  );
}
