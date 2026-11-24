/**
 * Scanner VerifyCheck — pointage QR réel via expo-camera et /api/scan.
 * Présence affichée uniquement après validation serveur. La file hors ligne
 * conserve ses états EN ATTENTE / CONFIRMÉ / REJETÉ.
 */

import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { getDashboard, type DashboardData } from "../services/api";
import { enregistrerScan } from "../store/scan";
import { theme } from "../theme";
import type { Selection } from "./AccueilScreen";
import type { ScanEtat } from "../lib/scanStatus";

const LIBELLES: Record<string, { titre: string; detail: string; couleur: string }> = {
  confirmee: {
    titre: "Présence confirmée",
    detail: "Le serveur a validé le pointage.",
    couleur: theme.success,
  },
  doublon: {
    titre: "Déjà scanné",
    detail: "Ce cours a déjà validé cette carte.",
    couleur: theme.warn,
  },
  qr_invalide: {
    titre: "Carte non reconnue",
    detail: "Aucun élève pour ce code (réponse du serveur).",
    couleur: theme.danger,
  },
  pas_de_cours: {
    titre: "Aucun cours applicable",
    detail: "Aucun cours actif pour cette classe à l’heure de Conakry.",
    couleur: theme.danger,
  },
  cours_ambigu: {
    titre: "Contexte ambigu",
    detail: "Plusieurs cours actifs — précise le cours ou la salle dans le contexte.",
    couleur: theme.warn,
  },
  salle_invalide: {
    titre: "Salle / cours incorrects",
    detail: "Le cours choisi ne correspond pas à la salle ou n’est pas actif.",
    couleur: theme.warn,
  },
  session_expiree: {
    titre: "Session expirée",
    detail: "Reconnexion nécessaire.",
    couleur: theme.danger,
  },
  erreur_serveur: {
    titre: "Erreur serveur",
    detail: "Réponse inattendue — le pointage n’est PAS confirmé. Réessaie.",
    couleur: theme.danger,
  },
  hors_ligne: {
    titre: "En attente de synchronisation",
    detail: "Réseau indisponible — le pointage reste EN ATTENTE jusqu’à confirmation du serveur.",
    couleur: theme.warn,
  },
  deja_en_attente: {
    titre: "Déjà en attente",
    detail: "Ce pointage est déjà dans la file hors ligne.",
    couleur: theme.warn,
  },
};

type Affiche = { kind: string; detail: string; couleur: string; eleve?: string };

export function ScannerScreen({
  selection,
  onSessionExpiree,
}: {
  selection: Selection;
  onSessionExpiree: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraErreur, setCameraErreur] = useState(false);
  const [etat, setEtat] = useState<Affiche | null>(null);
  const [busy, setBusy] = useState(false);
  const [manuel, setManuel] = useState("");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);

  const rafraichir = useCallback(async () => {
    const res = await getDashboard(selection.classeId);
    if (res.ok) setDashboard(res.data);
  }, [selection.classeId]);

  useEffect(() => {
    void rafraichir();
  }, [rafraichir]);

  async function scanner(code: string) {
    const value = code.trim().toUpperCase();
    if (!value || busy) return;
    setBusy(true);
    const res = await enregistrerScan(value, {
      coursId: selection.coursId,
      coursNom: selection.coursNom,
      salle: selection.salle,
    });
    setBusy(false);
    afficher(res);
    if (res.kind === "session_expiree") onSessionExpiree();
    await rafraichir();
  }

  function afficher(res: ScanEtat) {
    const lib = LIBELLES[res.kind];
    const couleur = lib?.couleur ?? theme.line;
    const detail =
      res.kind === "confirmee" && res.eleve
        ? `${res.eleve} · ${res.cours ?? selection.coursNom}`
        : res.kind === "pas_de_cours" && res.heure
          ? `${lib?.detail ?? ""} Il est ${res.heure}.`
          : (lib?.detail ?? "");
    setEtat({
      kind: res.kind,
      detail,
      couleur,
      eleve: res.kind === "confirmee" ? res.eleve : undefined,
    });
  }

  async function onScanCamera(result: { data?: string }) {
    await scanner(result.data ?? "");
  }

  if (!permission) {
    return <Centrer><ActivityIndicator color={theme.accent} /></Centrer>;
  }

  if (!permission.granted) {
    return (
      <Centrer>
        <Text style={s.titre}>Pointage en cours</Text>
        <Text style={s.meta}>Autorise l’accès à la caméra pour scanner les cartes élèves.</Text>
        <TouchableOpacity style={s.bouton} onPress={requestPermission}>
          <Text style={s.boutonTexte}>Autoriser la caméra</Text>
        </TouchableOpacity>
        <SaisieManuelle
          manuel={manuel}
          setManuel={setManuel}
          busy={busy}
          onSubmit={() => scanner(manuel)}
        />
      </Centrer>
    );
  }

  const cours = dashboard?.cours_prevus.find((c) => c.id === selection.coursId);
  const presents = cours
    ? (dashboard?.eleves ?? []).filter((e) =>
        e.presences.some((p) => p.course_id === cours.id)
      ).length
    : 0;
  const effectif = dashboard?.effectif ?? 0;
  const heureCours = cours
    ? `${cours.heure_debut.slice(0, 5)} – ${cours.heure_fin.slice(0, 5)}`
    : "Horaire de la séance";
  const fondEtat =
    etat?.kind === "confirmee" ? "#E7F6EF" :
    etat?.kind === "doublon" || etat?.kind === "hors_ligne" || etat?.kind === "deja_en_attente" ? "#FBF3E4" :
    "#FCEEEE";

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={s.pageHeading}>
        <Text style={s.titre}>Pointage en cours</Text>
        <View style={s.titleRule} />
      </View>

      <View style={s.sessionCard}>
        <View style={s.sessionIcon}>
          <Text style={s.sessionGlyph}>⌂</Text>
        </View>
        <View style={s.sessionInfo}>
          <Text style={s.sessionClasse}>{selection.classeNom}</Text>
          <Text style={s.sessionCours}>{selection.coursNom}</Text>
          <Text style={s.sessionHoraire}>{heureCours}</Text>
          {selection.salle ? <Text style={s.meta}>Salle {selection.salle}</Text> : null}
        </View>
      </View>

      <View style={s.compteur}>
        <View style={s.compteurLabelGroup}>
          <View style={s.compteurCheck}>
            <Text style={s.compteurCheckText}>✓</Text>
          </View>
          <Text style={s.compteurLabel}>Présents confirmés</Text>
        </View>
        <Text style={s.compteurNum}>
          {dashboard ? presents : "—"}
          <Text style={s.compteurTotal}> / {dashboard ? effectif : "—"}</Text>
        </Text>
      </View>

      {etat ? (
        <View style={[s.resultat, { borderColor: etat.couleur, backgroundColor: fondEtat }]}>
          <View style={s.resultatHeader}>
            <Text style={[s.resultatTitre, { color: etat.couleur }]}>
              {LIBELLES[etat.kind]?.titre ?? etat.kind}
            </Text>
            {busy ? <ActivityIndicator color={theme.accent} /> : null}
          </View>
          <Text style={s.resultatDetail}>{etat.detail}</Text>
          {etat.eleve ? <Text style={s.resultatCode}>Élève : {etat.eleve}</Text> : null}
        </View>
      ) : null}

      <View style={s.cameraWrap}>
        {cameraErreur ? (
          <View style={[s.camera, s.cameraBloc]}>
            <Text style={s.cameraErreur}>Caméra indisponible sur cet appareil.</Text>
            <Text style={s.cameraHint}>Utilise la saisie manuelle ci-dessous.</Text>
          </View>
        ) : (
          <CameraView
            style={s.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={busy ? undefined : onScanCamera}
            onMountError={() => setCameraErreur(true)}
          >
            <View pointerEvents="none" style={s.cameraOverlay}>
              <View style={s.scanFrame}>
                <View style={[s.scanCorner, s.cornerTopLeft]} />
                <View style={[s.scanCorner, s.cornerTopRight]} />
                <View style={[s.scanCorner, s.cornerBottomLeft]} />
                <View style={[s.scanCorner, s.cornerBottomRight]} />
                <Text style={s.scanGlyph}>▦</Text>
              </View>
              <Text style={s.cameraHint}>Place la carte QR dans le cadre</Text>
            </View>
          </CameraView>
        )}
      </View>

      <SaisieManuelle
        manuel={manuel}
        setManuel={setManuel}
        busy={busy}
        onSubmit={() => scanner(manuel)}
      />
    </ScrollView>
  );
}

function SaisieManuelle({
  manuel,
  setManuel,
  busy,
  onSubmit,
}: {
  manuel: string;
  setManuel: (v: string) => void;
  busy: boolean;
  onSubmit: () => void;
}) {
  return (
    <View style={s.manuel}>
      <TextInput
        style={s.input}
        placeholder="Saisie manuelle du code de la carte"
        placeholderTextColor={theme.inkSoft}
        autoCapitalize="characters"
        autoCorrect={false}
        returnKeyType="done"
        value={manuel}
        onChangeText={setManuel}
        onSubmitEditing={onSubmit}
        accessibilityLabel="Code QR de la carte élève"
      />
      <TouchableOpacity
        style={[s.bouton, (busy || !manuel.trim()) && s.boutonOff]}
        disabled={busy || !manuel.trim()}
        onPress={onSubmit}
        accessibilityRole="button"
      >
        {busy ? (
          <ActivityIndicator color={theme.white} />
        ) : (
          <Text style={s.boutonTexte}>Vérifier</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

function Centrer({ children }: { children: React.ReactNode }) {
  return (
    <View style={[s.root, { justifyContent: "center" }]}>
      <View style={s.permissionCard}>{children}</View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.paper },
  content: { padding: 16, paddingBottom: 22, gap: 12 },
  pageHeading: { gap: 7, marginBottom: 1 },
  titre: { fontSize: 26, lineHeight: 32, fontWeight: "800", color: "#102b4d", letterSpacing: -0.6 },
  titleRule: { width: 62, height: 2, backgroundColor: "#2b85d4" },
  meta: { color: theme.inkSoft, fontSize: theme.type.small },
  sessionCard: {
    minHeight: 92,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#dce5ef",
    borderRadius: 9,
    backgroundColor: theme.white,
  },
  sessionIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  sessionGlyph: { color: theme.accent, fontSize: 31, fontWeight: "700" },
  sessionInfo: { flex: 1, gap: 2 },
  sessionClasse: { color: "#102b4d", fontSize: 18, fontWeight: "700" },
  sessionCours: { color: "#53657a", fontSize: 14 },
  sessionHoraire: { color: "#53657a", fontSize: 13, marginTop: 2 },
  compteur: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#c8ead8",
    borderRadius: 8,
    backgroundColor: "#E2F5EB",
  },
  compteurLabelGroup: { flexDirection: "row", alignItems: "center", gap: 8 },
  compteurCheck: {
    width: 25,
    height: 25,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 99,
    backgroundColor: theme.success,
  },
  compteurCheckText: { color: theme.white, fontSize: 16, fontWeight: "800" },
  compteurLabel: { color: "#145d45", fontSize: 13, fontWeight: "700" },
  compteurNum: { color: "#104d3b", fontSize: 20, fontWeight: "800", fontVariant: ["tabular-nums"] },
  compteurTotal: { color: "#245e4d", fontSize: 17, fontWeight: "500" },
  resultat: {
    gap: 4,
    padding: 11,
    borderWidth: 1,
    borderRadius: 8,
  },
  resultatHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  resultatTitre: { fontWeight: "700", fontSize: 14 },
  resultatDetail: { color: theme.ink, fontSize: 12, lineHeight: 17 },
  resultatCode: { color: theme.inkSoft, fontSize: 11, fontFamily: "monospace" },
  cameraWrap: { width: "100%" },
  camera: {
    width: "100%",
    height: 190,
    overflow: "hidden",
    borderRadius: 9,
    backgroundColor: theme.scanBg,
  },
  cameraOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
  },
  scanFrame: {
    width: 142,
    height: 126,
    alignItems: "center",
    justifyContent: "center",
  },
  scanCorner: {
    position: "absolute",
    width: 26,
    height: 26,
    borderColor: "#fff",
  },
  cornerTopLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 3 },
  cornerTopRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 3 },
  cornerBottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 3 },
  cornerBottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 3 },
  scanGlyph: { color: "#fff", fontSize: 34, fontWeight: "700" },
  cameraHint: { color: "#fff", textAlign: "center", fontSize: 12, fontWeight: "600" },
  cameraBloc: { alignItems: "center", justifyContent: "center", gap: 8, padding: 12 },
  cameraErreur: { color: theme.white, fontSize: 14, fontWeight: "700" },
  manuel: { gap: 9 },
  input: {
    width: "100%",
    minHeight: 44,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#cbd6e3",
    borderRadius: 8,
    backgroundColor: theme.white,
    color: theme.ink,
    fontSize: 14,
  },
  bouton: {
    minHeight: 44,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#173f70",
  },
  boutonOff: { opacity: 0.55 },
  boutonTexte: { color: theme.white, fontWeight: "700", fontSize: 14 },
  permissionCard: {
    gap: 12,
    margin: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 9,
    backgroundColor: theme.white,
  },
});

