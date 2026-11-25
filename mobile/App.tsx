/**
 * VerifyCheck — navigation mobile dédiée aux opérations de pointage.
 * Le cours est déterminé automatiquement par le backend au moment du scan.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LoginScreen } from "./src/screens/LoginScreen";
import { AccueilScreen } from "./src/screens/AccueilScreen";
import { ScannerScreen } from "./src/screens/ScannerScreen";
import { HistoriqueScreen } from "./src/screens/HistoriqueScreen";
import { logout, session } from "./src/services/auth";
import { enAttente, enAttenteAvecCours, onFileChange, synchroniserFile } from "./src/store/scan";
import { verifierDisponibiliteServeur } from "./src/services/api";
import { theme } from "./src/theme";

type Onglet = "accueil" | "scanner" | "historique";
type EtatServeur = "connecte" | "indisponible" | "verification";

const ONGLETS: Array<{ id: Onglet; label: string; icon: string }> = [
  { id: "accueil", label: "Accueil", icon: "⌂" },
  { id: "scanner", label: "Scanner", icon: "▦" },
  { id: "historique", label: "Historique", icon: "◷" },
];

export default function App() {
  const [email, setEmail] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [onglet, setOnglet] = useState<Onglet>("scanner");
  const [etatServeur, setEtatServeur] = useState<EtatServeur>("verification");
  const [pendingCount, setPendingCount] = useState(0);
  const [synchronisation, setSynchronisation] = useState(false);
  const syncInProgress = useRef(false);

  const actualiserCompteur = useCallback(async () => {
    try {
      setPendingCount(await enAttente());
    } catch {
      // L'historique signalera une éventuelle erreur de lecture locale.
    }
  }, []);

  useEffect(() => {
    let active = true;
    void session()
      .then((stored) => {
        if (active) setEmail(stored?.user.email ?? null);
      })
      .catch(() => {
        if (active) setEmail(null);
      })
      .finally(() => {
        if (active) setChargement(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    void actualiserCompteur();
    return onFileChange(() => void actualiserCompteur());
  }, [actualiserCompteur]);

  const verifierServeurEtSynchroniser = useCallback(async () => {
    if (!email) return;
    const reachable = await verifierDisponibiliteServeur();
    setEtatServeur(reachable ? "connecte" : "indisponible");
    if (!reachable || syncInProgress.current) return;

    syncInProgress.current = true;
    setSynchronisation(true);
    try {
      if (await enAttenteAvecCours() > 0) await synchroniserFile();
    } catch {
      // Les éléments qui n'ont pas été confirmés restent dans la file.
    } finally {
      syncInProgress.current = false;
      setSynchronisation(false);
      void actualiserCompteur();
    }
  }, [actualiserCompteur, email]);

  useEffect(() => {
    if (!email) return;
    void verifierServeurEtSynchroniser();
    const interval = setInterval(() => void verifierServeurEtSynchroniser(), 45000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void verifierServeurEtSynchroniser();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [email, verifierServeurEtSynchroniser]);

  const deconnexion = useCallback(async () => {
    try {
      await logout();
    } finally {
      setEmail(null);
      setOnglet("scanner");
    }
  }, []);

  const sessionExpiree = useCallback(() => {
    Alert.alert("Session expirée", "Reconnecte-toi pour continuer les pointages.");
    void deconnexion();
  }, [deconnexion]);

  const ouvrirMenuCompte = useCallback(() => {
    Alert.alert("Compte agent", email ?? "", [
      {
        text: "À propos de VerifyCheck",
        onPress: () => Alert.alert(
          "VerifyCheck Mobile",
          "Application de pointage QR. Le cours est déterminé automatiquement par le serveur. Les droits du compte sont contrôlés par le backend."
        ),
      },
      { text: "Se déconnecter", style: "destructive", onPress: () => void deconnexion() },
      { text: "Fermer", style: "cancel" },
    ]);
  }, [deconnexion, email]);

  const ouvrirScanner = useCallback(() => setOnglet("scanner"), []);

  if (chargement) return <View style={s.loading} />;

  if (!email) {
    return (
      <LoginScreen
        onConnecte={(nextEmail) => {
          setEmail(nextEmail);
          setOnglet("scanner");
        }}
      />
    );
  }

  const serveurLabel =
    etatServeur === "connecte"
      ? "Serveur accessible"
      : etatServeur === "indisponible"
        ? "Serveur inaccessible — file locale conservée"
        : "Vérification du serveur…";

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={theme.accent} />
      <View style={s.header}>
        <View style={s.brand}>
          <View style={s.logoMark}>
            <Text style={s.logoText}>VC</Text>
          </View>
          <View style={s.brandCopy}>
            <Text style={s.brandName}>VerifyCheck</Text>
            <Text style={s.brandSubtitle}>SUIVI DES PRÉSENCES</Text>
          </View>
        </View>
        <TouchableOpacity
          style={s.account}
          onPress={ouvrirMenuCompte}
          accessibilityRole="button"
          accessibilityLabel="Ouvrir les options du compte"
        >
          <Text style={s.accountGlyph}>⋮</Text>
        </TouchableOpacity>
      </View>

      <View style={[s.connectionBar, etatServeur === "indisponible" && s.connectionOffline]}>
        <View
          style={[
            s.connectionDot,
            etatServeur === "connecte" && s.connectionDotOnline,
            etatServeur === "indisponible" && s.connectionDotOffline,
          ]}
        />
        <Text style={s.connectionText} numberOfLines={1}>{serveurLabel}</Text>
        {pendingCount > 0 ? (
          <Text style={s.pendingBadge}>{pendingCount} en attente</Text>
        ) : null}
        {synchronisation ? <Text style={s.syncLabel}>Sync…</Text> : null}
      </View>

      <View style={s.content}>
        {onglet === "accueil" ? <AccueilScreen onOpenScanner={ouvrirScanner} /> : null}
        {onglet === "scanner" ? <ScannerScreen onSessionExpiree={sessionExpiree} /> : null}
        {onglet === "historique" ? <HistoriqueScreen /> : null}
      </View>

      <View style={s.tabs}>
        {ONGLETS.map((item) => {
          const active = onglet === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              style={s.tab}
              onPress={() => setOnglet(item.id)}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: active }}
            >
              <Text style={[s.tabIcon, active && s.tabIconActive]}>{item.icon}</Text>
              <Text style={[s.tabLabel, active && s.tabLabelActive]}>{item.label}</Text>
              {active ? <View style={s.tabIndicator} /> : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.paper },
  loading: { flex: 1, backgroundColor: theme.paper },
  header: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    backgroundColor: theme.accent,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 11 },
  logoMark: {
    width: 39,
    height: 39,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.9)",
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { color: theme.white, fontWeight: "800", fontSize: 17 },
  brandCopy: { gap: 2 },
  brandName: { color: theme.white, fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  brandSubtitle: { color: "#D7E3F0", fontSize: 9, fontWeight: "700", letterSpacing: 0.9 },
  account: { width: 42, height: 44, alignItems: "center", justifyContent: "center" },
  accountGlyph: { color: theme.white, fontSize: 27, fontWeight: "700" },
  connectionBar: {
    minHeight: 31,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 14,
    backgroundColor: "#E8F4EE",
  },
  connectionOffline: { backgroundColor: "#FFF3E0" },
  connectionDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.inkSoft },
  connectionDotOnline: { backgroundColor: theme.success },
  connectionDotOffline: { backgroundColor: theme.warn },
  connectionText: { flex: 1, color: theme.inkSoft, fontSize: 10, fontWeight: "600" },
  pendingBadge: { color: theme.warnInk, fontSize: 10, fontWeight: "800" },
  syncLabel: { color: theme.accent, fontSize: 10, fontWeight: "800" },
  content: { flex: 1, minHeight: 0 },
  tabs: {
    minHeight: 62,
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: theme.line,
    backgroundColor: theme.white,
  },
  tab: {
    position: "relative",
    flex: 1,
    minHeight: 62,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
  },
  tabIcon: { color: theme.inkSoft, fontSize: 21, lineHeight: 25 },
  tabIconActive: { color: theme.accent },
  tabLabel: { color: theme.inkSoft, fontSize: 11, fontWeight: "500" },
  tabLabelActive: { color: theme.accent, fontWeight: "800" },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    width: "58%",
    height: 3,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    backgroundColor: theme.accent,
  },
});
