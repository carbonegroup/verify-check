/**
 * VerifyCheck — application mobile de pointage.
 * En-tête de marque, navigation à trois sections et écran de scan prioritaire.
 * La navigation reste locale et légère pour les appareils à connectivité limitée.
 */

import { useCallback, useEffect, useState } from "react";
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LoginScreen } from "./src/screens/LoginScreen";
import { AccueilScreen, type Selection } from "./src/screens/AccueilScreen";
import { ScannerScreen } from "./src/screens/ScannerScreen";
import { HistoriqueScreen } from "./src/screens/HistoriqueScreen";
import { logout, session } from "./src/services/auth";
import { theme } from "./src/theme";

type Onglet = "accueil" | "scanner" | "historique";

const ONGLETS: Array<{ id: Onglet; label: string; icon: string }> = [
  { id: "accueil", label: "Contexte", icon: "⌂" },
  { id: "scanner", label: "Scanner", icon: "▦" },
  { id: "historique", label: "Historique", icon: "◷" },
];

export default function App() {
  const [email, setEmail] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [onglet, setOnglet] = useState<Onglet>("accueil");
  const [menuOuvert, setMenuOuvert] = useState(false);

  useEffect(() => {
    session().then((s) => {
      setEmail(s?.user.email ?? null);
      setChargement(false);
    });
  }, []);

  const deconnexion = useCallback(async () => {
    setMenuOuvert(false);
    await logout();
    setEmail(null);
    setSelection(null);
    setOnglet("accueil");
  }, []);

  const commencerPointage = useCallback((next: Selection) => {
    setSelection(next);
    setOnglet("scanner");
  }, []);

  if (chargement) return <View style={s.paper} />;

  if (!email) {
    return <LoginScreen onConnecte={setEmail} />;
  }

  return (
    <SafeAreaView style={s.paper}>
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

        <View style={s.menuArea}>
          <TouchableOpacity
            style={s.menuTrigger}
            onPress={() => setMenuOuvert((open) => !open)}
            accessibilityRole="button"
            accessibilityLabel="Ouvrir le menu du compte"
            accessibilityState={{ expanded: menuOuvert }}
          >
            <Text style={s.menuDots}>⋮</Text>
          </TouchableOpacity>
          {menuOuvert ? (
            <View style={s.menuDropdown}>
              <Text style={s.menuEmail} numberOfLines={1}>{email}</Text>
              <TouchableOpacity onPress={deconnexion} style={s.menuLogout}>
                <Text style={s.menuLogoutText}>Se déconnecter</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </View>

      {selection ? (
        <>
          <View style={s.contenu}>
            {onglet === "accueil" ? (
              <AccueilScreen email={email} onSelection={commencerPointage} onLogout={deconnexion} />
            ) : null}
            {onglet === "scanner" ? (
              <ScannerScreen selection={selection} onSessionExpiree={deconnexion} />
            ) : null}
            {onglet === "historique" ? (
              <HistoriqueScreen classeId={selection.classeId} onSessionExpiree={deconnexion} />
            ) : null}
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
                  <Text style={[s.tabIcon, active && s.tabIconOn]}>{item.icon}</Text>
                  <Text style={[s.tabTexte, active && s.tabTexteOn]}>{item.label}</Text>
                  {active ? <View style={s.tabIndicator} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      ) : (
        <View style={s.contenu}>
          <AccueilScreen email={email} onSelection={commencerPointage} onLogout={deconnexion} />
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  paper: { flex: 1, backgroundColor: theme.paper },
  contenu: { flex: 1, minHeight: 0 },
  header: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.accent,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 12 },
  logoMark: {
    width: 42,
    height: 42,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.9)",
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { color: theme.white, fontWeight: "800", fontSize: 18, letterSpacing: -0.5 },
  brandCopy: { gap: 2 },
  brandName: { color: theme.white, fontSize: 19, fontWeight: "700", letterSpacing: -0.3 },
  brandSubtitle: { color: "rgba(255,255,255,0.82)", fontSize: 10, fontWeight: "700", letterSpacing: 0.8 },
  menuArea: { position: "relative", zIndex: 20 },
  menuTrigger: { width: 40, height: 44, alignItems: "center", justifyContent: "center" },
  menuDots: { color: theme.white, fontSize: 28, lineHeight: 30, fontWeight: "700" },
  menuDropdown: {
    position: "absolute",
    top: 44,
    right: 0,
    width: 190,
    padding: 10,
    borderRadius: 8,
    backgroundColor: theme.white,
    borderWidth: 1,
    borderColor: theme.line,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 8,
  },
  menuEmail: { paddingHorizontal: 7, paddingVertical: 5, color: theme.inkSoft, fontSize: 11 },
  menuLogout: { minHeight: 40, justifyContent: "center", paddingHorizontal: 7 },
  menuLogoutText: { color: theme.danger, fontSize: 13, fontWeight: "700" },
  tabs: {
    minHeight: 66,
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: theme.line,
    backgroundColor: theme.white,
  },
  tab: {
    position: "relative",
    flex: 1,
    minHeight: 66,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    paddingTop: 5,
  },
  tabIcon: { color: theme.inkSoft, fontSize: 23, lineHeight: 27 },
  tabIconOn: { color: "#1760a7" },
  tabTexte: { color: theme.inkSoft, fontSize: 11, fontWeight: "500" },
  tabTexteOn: { color: "#174f88", fontWeight: "700" },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    width: "66%",
    height: 3,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    backgroundColor: "#174f88",
  },
});
