/**
 * Écran scanner — caméra native (expo-camera), pointage réel via /api/scan.
 * Inclut la saisie manuelle du code (carte abîmée / caméra indisponible),
 * le compteur réel du cours et l'historique local des vérifications.
 * Aucun état « confirmée » sans réponse du serveur.
 */

import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { getDashboard, type DashboardData } from "../services/api";
import { enregistrerScan, historique, onFileChange, type LocalItem } from "../store/scan";
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
    detail: "Aucun cours actif pour cette classe à l'heure de Conakry.",
    couleur: theme.danger,
  },
  cours_ambigu: {
    titre: "Contexte ambigu",
    detail: "Plusieurs cours actifs — précise le cours ou la salle dans le contexte.",
    couleur: theme.warn,
  },
  salle_invalide: {
    titre: "Salle / cours incorrects",
    detail: "Le cours choisi ne correspond pas à la salle ou n'est pas actif.",
    couleur: theme.warn,
  },
  session_expiree: {
    titre: "Session expirée",
    detail: "Reconnexion nécessaire.",
    couleur: theme.danger,
  },
  erreur_serveur: {
    titre: "Erreur serveur",
    detail: "Réponse inattendue — le pointage n'est PAS confirmé. Réessaie.",
    couleur: theme.danger,
  },
  hors_ligne: {
    titre: "En attente de synchronisation",
    detail: "Réseau indisponible — le pointage reste EN ATTENTE jusqu'à confirmation du serveur.",
    couleur: theme.warn,
  },
  deja_en_attente: {
    titre: "Déjà en attente",
    detail: "Ce pointage est déjà dans la file hors ligne.",
    couleur: theme.warn,
  },
};

export function ScannerScreen({
  selection,
  onSessionExpiree,
}: {
  selection: Selection;
  onSessionExpiree: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraErreur, setCameraErreur] = useState(false);
  const [etat, setEtat] = useState<{ kind: string; detail?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [manuel, setManuel] = useState("");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [locaux, setLocaux] = useState<LocalItem[]>([]);

  const rafraichir = useCallback(async () => {
    const res = await getDashboard(selection.classeId);
    if (res.ok) setDashboard(res.data);
    setLocaux(await historique());
  }, [selection.classeId]);

  useEffect(() => {
    rafraichir();
    return onFileChange(rafraichir);
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
    const detail =
      res.kind === "confirmee" && res.eleve
        ? `${res.eleve} · ${res.cours ?? selection.coursNom}`
        : res.kind === "pas_de_cours" && res.heure
          ? `${lib?.detail ?? ""} Il est ${res.heure}.`
          : (lib?.detail ?? "");
    setEtat({ kind: res.kind, detail });
  }

  async function onScanCamera(result: { data?: string }) {
    await scanner(result.data ?? "");
  }

  // Permission caméra : états explicites (jamais un blocage muet).
  if (!permission) {
    return <Centrer><ActivityIndicator color={theme.accent} /></Centrer>;
  }
  if (!permission.granted) {
    return (
      <Centrer>
        <Text style={s.erreur}>Caméra refusée ou indisponible.</Text>
        <Text style={s.meta}>
          Autorise la caméra pour scanner les cartes, ou utilise la saisie manuelle ci-dessous.
        </Text>
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

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={s.session}>
        <Text style={s.eyebrow}>SÉANCE SÉLECTIONNÉE</Text>
        <Text style={s.titre}>{selection.coursNom}</Text>

        <Text style={s.sessionMeta}>
          {selection.classeNom}
          {selection.salle ? " · " + selection.salle : ""}
          {cours ? ` · ${cours.heure_debut.slice(0, 5)}–${cours.heure_fin.slice(0, 5)}` : ""}
        </Text>
      </View>

      <View style={s.compteur}>
        <Text style={s.compteurNum}>
          {presents}
          <Text style={s.compteurTotal}>/{effectif}</Text>
        </Text>
        <Text style={s.compteurLabel}>présents confirmés (serveur)</Text>
      </View>

      {/* Résultat du scan — affiché avec couleur + texte obligatoire */}
      <View style={[
        s.resultat,
        { borderColor: etat ? LIBELLES[etat.kind]?.couleur ?? theme.line : theme.line },
        { marginTop: 12 },
      ]}>
        <Text style={[s.resultatTitre, { color: etat ? LIBELLES[etat.kind]?.couleur ?? theme.ink : theme.inkSoft }, { fontWeight: "700" }]}>
          {etat ? LIBELLES[etat.kind]?.titre ?? etat.kind : "En attente d'un scan"}
        </Text>
        <Text style={s.meta}>{etat?.detail ?? "Approche la carte élève de la caméra."}</Text>
        {busy ? <ActivityIndicator color={theme.accent} style={{ marginTop: 8 }} /> : null}
      </View>

      {cameraErreur ? (
        <View style={s.cameraBloc}>
          <Text style={s.meta}>Caméra indisponible sur cet appareil.</Text>
        </View>
      ) : (
        <CameraView
          style={s.camera}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={onScanCamera}
          onMountError={() => setCameraErreur(true)}
        >
          <Text style={s.cameraHint}>Place la carte QR dans le cadre</Text>
        </CameraView>
      )}

      <SaisieManuelle manuel={manuel} setManuel={setManuel} busy={busy} onSubmit={() => scanner(manuel)} />

      <View style={s.historique}>
        <Text style={s.sousTitre}>Derniers pointages (locaux)</Text>
        {locaux.length === 0 ? (
          <Text style={s.meta}>Aucun pointage enregistré sur cet appareil.</Text>
        ) : (
          locaux.slice(0, 6).map((item) => (
            <View key={item.id} style={s.historiqueLigne}>
              <Text style={s.historiqueCode}>{item.code_qr}</Text>
              <Text style={[s.historiqueEtat, { color: item.etat === "en_attente" ? theme.warn : item.etat === "rejete" ? theme.danger : theme.success }]}>
                {item.etat === "en_attente" ? "EN ATTENTE" : item.etat === "rejete" ? "REJETÉ" : "CONFIRMÉ"}
              </Text>
            </View>
          ))
        )}
      </View>
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
        autoCapitalize="characters"
        autoCorrect={false}
        value={manuel}
        onChangeText={setManuel}
        onSubmitEditing={onSubmit}
      />
      <TouchableOpacity style={s.bouton} disabled={busy || !manuel.trim()} onPress={onSubmit}>
        <Text style={s.boutonTexte}>Vérifier</Text>
      </TouchableOpacity>
    </View>
  );
}

function Centrer({ children }: { children: React.ReactNode }) {
  return (
    <View style={[s.root, { alignItems: "center", justifyContent: "center", gap: 8, padding: theme.space.lg }]}>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.paper },
  content: { padding: theme.space.lg, paddingBottom: 28, gap: 12 },
  session: { padding: theme.space.lg, gap: 5, borderWidth: 1, borderColor: theme.line, borderRadius: theme.radius, backgroundColor: theme.white },
  eyebrow: { color: theme.blue, fontSize: 9, fontWeight: "800", letterSpacing: 1.1 },
  titre: { fontSize: 23, fontWeight: "800", letterSpacing: -0.5, color: theme.ink },
  meta: { color: theme.inkSoft, fontSize: theme.type.small, lineHeight: 19 },
  sessionMeta: { color: theme.inkSoft, fontSize: 12, lineHeight: 18, marginTop: 2 },
  compteur: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: theme.space.lg, paddingVertical: 13, borderWidth: 1, borderColor: theme.line, borderRadius: theme.radius, backgroundColor: theme.white },
  compteurNum: { fontSize: theme.type.big, fontWeight: "800", color: theme.navy, fontVariant: ["tabular-nums"] },
  compteurTotal: { fontSize: 17, color: theme.inkSoft, fontWeight: "500" },
  compteurLabel: { maxWidth: 125, fontSize: 10, color: theme.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: "700", textAlign: "right" },
  resultat: { borderWidth: 1, borderLeftWidth: 4, borderRadius: theme.radius, backgroundColor: theme.white, padding: 14, gap: 4 },
  resultatTitre: { fontWeight: "800", fontSize: 14 },
  camera: { height: 270, borderRadius: theme.radius, overflow: "hidden", backgroundColor: theme.scanBg, justifyContent: "flex-end", padding: theme.space.md },
  cameraHint: { alignSelf: "center", overflow: "hidden", borderRadius: 20, paddingHorizontal: 13, paddingVertical: 7, color: "#FFFFFF", backgroundColor: "rgba(23,43,69,0.72)", textAlign: "center", fontSize: 12, fontWeight: "700" },
  cameraBloc: { height: 220, borderRadius: theme.radius, backgroundColor: theme.scanBg, borderWidth: 1, borderColor: theme.line, justifyContent: "center", alignItems: "center", padding: theme.space.lg },
  manuel: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: { flex: 1, minWidth: 0, height: 46, borderRadius: theme.radiusSm, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.white, paddingHorizontal: 12, color: theme.ink, fontSize: 12 },
  bouton: { minHeight: 46, paddingHorizontal: 15, borderRadius: theme.radiusSm, backgroundColor: theme.navy, alignItems: "center", justifyContent: "center" },
  boutonTexte: { color: theme.white, fontWeight: "800", fontSize: 12 },
  historique: { gap: 8, padding: theme.space.md, borderWidth: 1, borderColor: theme.line, borderRadius: theme.radius, backgroundColor: theme.white },
  sousTitre: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8, color: theme.inkSoft, fontWeight: "800", marginBottom: 2 },
  historiqueLigne: { minHeight: 35, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, borderTopWidth: 1, borderTopColor: "#EEF2F6", paddingTop: 7 },
  historiqueCode: { flexShrink: 1, fontFamily: "monospace", color: theme.ink, fontSize: 11 },
  historiqueEtat: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
  erreur: { color: theme.danger, fontSize: theme.type.body, textAlign: "center" },
});
