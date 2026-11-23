/**
 * Racine de l'app mobile VerifyCheck.
 * - gate de session : Login ↔ onglets (Accueil / Scanner / Historique) ;
 * - la navigation est volontairement simple (état local, pas de dépendance
 *   de navigation) : un seul flux admin, 3 écrans.
 */

import { useCallback, useEffect, useState } from "react";
import { SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LoginScreen } from "./src/screens/LoginScreen";
import { AccueilScreen, type Selection } from "./src/screens/AccueilScreen";
import { ScannerScreen } from "./src/screens/ScannerScreen";
import { HistoriqueScreen } from "./src/screens/HistoriqueScreen";
import { logout, session } from "./src/services/auth";
import { theme } from "./src/theme";

type Onglet = "accueil" | "scanner" | "historique";

export default function App() {
  const [email, setEmail] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [onglet, setOnglet] = useState<Onglet>("accueil");

  useEffect(() => {
    session().then((s) => {
      setEmail(s?.user.email ?? null);
      setChargement(false);
    });
  }, []);

  const deconnexion = useCallback(async () => {
    await logout();
    setEmail(null);
    setSelection(null);
    setOnglet("accueil");
  }, []);

  if (chargement) return <View style={s.paper} />;

  if (!email) {
    return <LoginScreen onConnecte={setEmail} />;
  }

  return (
    <SafeAreaView style={s.paper}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.paper} />
      <View style={s.brandBar}>
        <View style={s.brandMark}><Text style={s.brandMarkText}>VC</Text></View>
        <View style={s.brandCopy}>
          <Text style={s.brandTitle}>VerifyCheck</Text>
          <Text style={s.brandCaption}>SUIVI DES PRÉSENCES</Text>
        </View>
      </View>
      {selection ? (
        <>
          <View style={s.contenu}>
            {onglet === "accueil" ? (
              <AccueilScreen email={email} onSelection={setSelection} onLogout={deconnexion} />
            ) : null}
            {onglet === "scanner" ? (
              <ScannerScreen
                selection={selection}
                onSessionExpiree={deconnexion}
              />
            ) : null}
            {onglet === "historique" ? (
              <HistoriqueScreen classeId={selection.classeId} onSessionExpiree={deconnexion} />
            ) : null}
          </View>
          <View style={s.tabs}>
            {(
              [
                ["accueil", "Contexte"],
                ["scanner", "Scanner"],
                ["historique", "Historique"],
              ] as Array<[Onglet, string]>
            ).map(([id, label]) => (
              <TouchableOpacity
                key={id}
                style={[s.tab, onglet === id && s.tabOn]}
                onPress={() => setOnglet(id)}
                accessibilityRole="button"
                accessibilityState={{ selected: onglet === id }}
                accessibilityLabel={label}
              >
                <Text style={[s.tabIndex, onglet === id && s.tabIndexOn]}>
                  {id === "accueil" ? "01" : id === "scanner" ? "02" : "03"}
                </Text>
                <Text style={[s.tabTexte, onglet === id && s.tabTexteOn]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : (
        <AccueilScreen email={email} onSelection={setSelection} onLogout={deconnexion} />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  paper: { flex: 1, backgroundColor: theme.paper },
  brandBar: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.line,
    backgroundColor: theme.white,
  },
  brandMark: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: theme.navy,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },
  brandMarkText: { color: theme.white, fontSize: 13, fontWeight: "800", letterSpacing: -0.5 },
  brandCopy: { gap: 1 },
  brandTitle: { color: theme.ink, fontSize: 16, fontWeight: "800", letterSpacing: -0.4 },
  brandCaption: { color: theme.inkSoft, fontSize: 9, fontWeight: "700", letterSpacing: 1.1 },
  contenu: { flex: 1 },
  tabs: {
    flexDirection: "row",
    minHeight: 62,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: theme.line,
    backgroundColor: theme.white,
  },
  tab: {
    flex: 1,
    minHeight: 58,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    marginHorizontal: 3,
    marginVertical: 4,
    borderRadius: 9,
  },
  tabOn: { backgroundColor: theme.navySoft },
  tabIndex: { color: theme.muted, fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  tabIndexOn: { color: theme.navy },
  tabTexte: { color: theme.inkSoft, fontSize: 12, fontWeight: "600" },
  tabTexteOn: { color: theme.navy, fontWeight: "800" },
});
