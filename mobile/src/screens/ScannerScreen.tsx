/**
 * Scanner VerifyCheck.
 * Le backend identifie la carte et détermine le cours ; l'agent confirme
 * chaque pointage. Le mode continu ne saute jamais cette confirmation.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { enregistrerScan, mettreEnAttente } from "../store/scan";
import { previsualiserScan } from "../services/api";
import { theme } from "../theme";
import type { ScanEtat } from "../lib/scanStatus";

const PREFERENCE_SCAN_KEY = "vc.mobile.settings.scan-continuous";
type SelectionScan = { coursId: string; coursNom: string; salle?: string };

const LIBELLES: Record<ScanEtat["kind"], { titre: string; detail: string; couleur: string }> = {
  previsualisation: {
    titre: "Carte reconnue",
    detail: "Vérifie les informations de la carte avant de confirmer le pointage.",
    couleur: theme.accent,
  },
  confirmee: {
    titre: "Présence confirmée",
    detail: "Le serveur a validé la présence de cet élève.",
    couleur: theme.success,
  },
  doublon: {
    titre: "Déjà pointé",
    detail: "Cette carte possède déjà un pointage pour ce cours.",
    couleur: theme.warn,
  },
  qr_invalide: {
    titre: "Carte non reconnue",
    detail: "Aucun élève ne correspond à ce QR code.",
    couleur: theme.danger,
  },
  pas_de_cours: {
    titre: "Aucun cours applicable",
    detail: "Aucun cours actif ne correspond à cette heure. Aucun pointage n'a été enregistré.",
    couleur: theme.danger,
  },
  cours_ambigu: {
    titre: "Séance à vérifier",
    detail: "Plusieurs cours correspondent à cette heure. Aucun pointage n'a été enregistré. Demande au responsable de vérifier le planning.",
    couleur: theme.warn,
  },
  salle_invalide: {
    titre: "Salle ou cours incorrect",
    detail: "La salle ne correspond pas au cours. Aucun pointage n'a été enregistré.",
    couleur: theme.warn,
  },
  session_expiree: {
    titre: "Session expirée",
    detail: "Reconnecte-toi pour continuer les pointages.",
    couleur: theme.danger,
  },
  acces_refuse: {
    titre: "Accès refusé",
    detail: "Ce compte n'est pas autorisé à effectuer ce pointage. Contacte l'administrateur.",
    couleur: theme.danger,
  },
  erreur_requete: {
    titre: "Demande non reconnue",
    detail: "Le serveur n'a pas accepté cette opération. Aucun pointage n'a été ajouté à la file locale.",
    couleur: theme.danger,
  },
  stockage_impossible: {
    titre: "Enregistrement local impossible",
    detail: "Le scan n'a pas pu être conservé sur cet appareil. Aucune confirmation n'est affichée ; reconnecte-toi et rescane la carte.",
    couleur: theme.danger,
  },
  erreur_serveur: {
    titre: "Validation impossible",
    detail: "Le serveur n'a pas confirmé ce pointage. Vérifie son état dans l'historique.",
    couleur: theme.danger,
  },
  hors_ligne: {
    titre: "Scan conservé — connexion requise",
    detail: "Aucune présence n'est confirmée. Le scan reste en attente et devra être résolu avec le serveur.",
    couleur: theme.warn,
  },
  deja_en_attente: {
    titre: "Déjà en attente",
    detail: "Ce QR code est déjà dans la file de synchronisation.",
    couleur: theme.warn,
  },
};

type ResultatAffiche = {
  kind: ScanEtat["kind"];
  code: string;
  eleve?: string;
  classe?: string;
  cours?: string;
  heure?: string;
  candidates?: Array<{ id: string; nom: string; salle: string | null; heure_debut?: string; heure_fin?: string }>;
  selection?: SelectionScan;
};

function vibrationSucces() {
  Vibration.vibrate(35);
}

function vibrationAlerte() {
  Vibration.vibrate([0, 40, 65, 40]);
}

export function ScannerScreen({ onSessionExpiree }: { onSessionExpiree: () => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const permissionDemandee = useRef(false);
  const [cameraErreur, setCameraErreur] = useState(false);
  const [resultat, setResultat] = useState<ResultatAffiche | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanContinu, setScanContinu] = useState(false);
  const [flashActive, setFlashActive] = useState(false);
  const [zoom, setZoom] = useState(0);
  const scanBloque = useRef(false);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(PREFERENCE_SCAN_KEY)
      .then((value) => {
        if (active) setScanContinu(value === "true");
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain && !permissionDemandee.current) {
      permissionDemandee.current = true;
      void requestPermission();
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    if (resultat?.kind !== "confirmee" || !scanContinu || busy) return;
    const timeout = setTimeout(() => {
      setResultat(null);
      scanBloque.current = false;
    }, 1000);
    return () => clearTimeout(timeout);
  }, [busy, resultat, scanContinu]);

  const changerModeContinu = useCallback((enabled: boolean) => {
    setScanContinu(enabled);
    void AsyncStorage.setItem(PREFERENCE_SCAN_KEY, String(enabled)).catch(() => undefined);
  }, []);

  const scanner = useCallback(async (code: string, selection?: SelectionScan) => {
    const value = code.trim().toUpperCase();
    if (!value || scanBloque.current) return;

    scanBloque.current = true;
    setBusy(true);

    try {
      let response = await previsualiserScan(value, selection);
      if (response.kind === "hors_ligne" || response.kind === "erreur_serveur") {
        response = await mettreEnAttente(value, selection);
      }

      const affiche: ResultatAffiche = { kind: response.kind, code: value };
      if ("eleve" in response) affiche.eleve = response.eleve;
      if ("classe" in response) affiche.classe = response.classe;
      if ("cours" in response) affiche.cours = response.cours;
      if (response.kind === "pas_de_cours") affiche.heure = response.heure;
      if (response.kind === "cours_ambigu") affiche.candidates = response.candidates;
      if (response.kind === "previsualisation") {
        affiche.selection = selection ?? (
          response.coursId && response.cours
            ? { coursId: response.coursId, coursNom: response.cours }
            : undefined
        );
      }
      if (response.kind !== "previsualisation" && response.kind !== "confirmee") {
        vibrationAlerte();
      }
      setResultat(affiche);

      if (response.kind === "session_expiree") onSessionExpiree();
    } catch {
      vibrationAlerte();
      setResultat({ kind: "stockage_impossible", code: value });
    } finally {
      setBusy(false);
    }
  }, [onSessionExpiree]);

  const gererCodeBarres = useCallback((value: { data: string }) => {
    void scanner(value.data);
  }, [scanner]);

  const confirmerPointage = useCallback(async () => {
    if (!resultat || resultat.kind !== "previsualisation" || busy) return;
    setBusy(true);
    try {
      const response = await enregistrerScan(resultat.code, resultat.selection);
      const affiche: ResultatAffiche = { kind: response.kind, code: resultat.code };
      if ("eleve" in response) affiche.eleve = response.eleve;
      if ("classe" in response) affiche.classe = response.classe;
      if ("cours" in response) affiche.cours = response.cours;
      if (response.kind === "pas_de_cours") affiche.heure = response.heure;
      if (response.kind === "cours_ambigu") affiche.candidates = response.candidates;
      setResultat(affiche);

      if (response.kind === "confirmee") vibrationSucces();
      else vibrationAlerte();

      if (response.kind === "session_expiree") onSessionExpiree();
    } catch {
      vibrationAlerte();
      setResultat({ kind: "stockage_impossible", code: resultat.code });
    } finally {
      setBusy(false);
    }
  }, [busy, onSessionExpiree, resultat]);

  const scannerSuivant = useCallback(() => {
    setResultat(null);
    scanBloque.current = false;
  }, []);

  if (!permission) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={s.body}>Préparation de la caméra…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={s.center}>
        <View style={s.permissionCard}>
          <Text style={s.resultTitle}>Accès à la caméra requis</Text>
          <Text style={s.body}>
            VerifyCheck a besoin de la caméra pour lire les cartes QR. Autorise l'accès dans les réglages du téléphone.
          </Text>
          <TouchableOpacity
            style={s.primary}
            onPress={() => {
              if (permission.canAskAgain) void requestPermission();
              else void Linking.openSettings().catch(() => undefined);
            }}
            accessibilityRole="button"
          >
            <Text style={s.primaryText}>
              {permission.canAskAgain ? "Autoriser la caméra" : "Ouvrir les réglages"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (resultat) {
    const meta = LIBELLES[resultat.kind];
    const confirme = resultat.kind === "confirmee" || resultat.kind === "previsualisation";

    return (
      <View style={s.resultScreen}>
        <View style={s.resultCard}>
          <View style={[s.statusMark, { backgroundColor: meta.couleur + "18" }]}>
            <Text style={[s.statusGlyph, { color: meta.couleur }]}>
              {confirme ? "✓" : resultat.kind === "hors_ligne" ? "…" : "!"}
            </Text>
          </View>
          <Text style={[s.resultTitle, { color: meta.couleur }]}>{meta.titre}</Text>
          <Text style={s.body}>{meta.detail}</Text>

          {resultat.eleve || resultat.classe || resultat.cours ? (
            <View style={s.studentBlock}>
              {resultat.eleve ? (
                <>
                  <Text style={s.fieldLabel}>ÉLÈVE</Text>
                  <Text style={s.studentName}>{resultat.eleve}</Text>
                </>
              ) : null}
              {resultat.classe ? (
                <>
                  <Text style={s.fieldLabel}>CLASSE</Text>
                  <Text style={s.fieldValue}>{resultat.classe}</Text>
                </>
              ) : null}
              {resultat.cours ? (
                <>
                  <Text style={s.fieldLabel}>COURS</Text>
                  <Text style={s.fieldValue}>{resultat.cours}</Text>
                </>
              ) : null}
            </View>
          ) : null}

          {resultat.candidates?.length ? (
            <View style={s.candidateList}>
              <Text style={s.fieldLabel}>COURS QUI CORRESPONDENT</Text>
              {resultat.candidates.map((candidate) => (
                <View key={candidate.id} style={s.candidate}>
                  <View style={s.candidateCopy}>
                    <Text style={s.candidateName}>{candidate.nom}</Text>
                    <Text style={s.candidateMeta}>
                      {candidate.heure_debut && candidate.heure_fin
                        ? candidate.heure_debut.slice(0, 5) + "–" + candidate.heure_fin.slice(0, 5)
                        : "Horaire non communiqué"}
                      {candidate.salle ? " · " + candidate.salle : ""}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {resultat.heure ? <Text style={s.body}>Heure serveur : {resultat.heure}</Text> : null}

          {resultat.kind === "previsualisation" ? (
            <>
              <TouchableOpacity
                style={s.primary}
                onPress={() => void confirmerPointage()}
                disabled={busy}
                accessibilityRole="button"
              >
                {busy ? (
                  <ActivityIndicator color={theme.white} />
                ) : (
                  <Text style={s.primaryText}>Confirmer le pointage</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={s.secondary} onPress={scannerSuivant} disabled={busy}>
                <Text style={s.secondaryText}>Annuler / Scanner suivant</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={s.primary} onPress={scannerSuivant} accessibilityRole="button">
              <Text style={s.primaryText}>Scanner le suivant</Text>
            </TouchableOpacity>
          )}

          {resultat.kind === "confirmee" && scanContinu ? (
            <Text style={s.autoNext}>Caméra relancée automatiquement…</Text>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <View style={s.scanHeading}>
        <View style={s.headingCopy}>
          <Text style={s.scanTitle}>Scanner une carte</Text>
          <Text style={s.scanSubtitle}>Place le QR code dans le cadre.</Text>
        </View>
      </View>

      <View style={s.cameraToolbar}>
        <TouchableOpacity
          style={[s.toolButton, flashActive && s.toolButtonActive]}
          onPress={() => setFlashActive((active) => !active)}
          accessibilityRole="switch"
          accessibilityLabel="Flash de la caméra"
          accessibilityState={{ checked: flashActive }}
        >
          <Text style={[s.toolButtonText, flashActive && s.toolButtonTextActive]}>
            {flashActive ? "Flash activé" : "Flash désactivé"}
          </Text>
        </TouchableOpacity>

        <View style={s.zoomControls}>
          <TouchableOpacity
            style={s.zoomButton}
            onPress={() => setZoom((value) => Math.max(0, Number((value - 0.1).toFixed(1))))}
            disabled={zoom <= 0}
            accessibilityRole="button"
            accessibilityLabel="Diminuer le zoom"
          >
            <Text style={s.zoomText}>−</Text>
          </TouchableOpacity>
          <Text style={s.zoomValue}>{zoom === 0 ? "1×" : "+" + Math.round(zoom * 100) + "%"}</Text>
          <TouchableOpacity
            style={s.zoomButton}
            onPress={() => setZoom((value) => Math.min(1, Number((value + 0.1).toFixed(1))))}
            disabled={zoom >= 1}
            accessibilityRole="button"
            accessibilityLabel="Augmenter le zoom"
          >
            <Text style={s.zoomText}>+</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[s.toolButton, scanContinu && s.toolButtonActive]}
          onPress={() => changerModeContinu(!scanContinu)}
          accessibilityRole="switch"
          accessibilityLabel="Mode de scan continu"
          accessibilityState={{ checked: scanContinu }}
        >
          <Text style={[s.toolButtonText, scanContinu && s.toolButtonTextActive]}>
            {scanContinu ? "Continu : ON" : "Continu : OFF"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={s.cameraStage}>
        {cameraErreur ? (
          <View style={s.cameraError}>
            <Text style={s.cameraErrorTitle}>Caméra indisponible</Text>
            <Text style={s.cameraHint}>Vérifie l'autorisation et réessaie.</Text>
            <TouchableOpacity style={s.retry} onPress={() => setCameraErreur(false)}>
              <Text style={s.retryText}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <CameraView
            style={s.camera}
            facing="back"
            enableTorch={flashActive}
            zoom={zoom}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={busy ? undefined : gererCodeBarres}
            onMountError={() => setCameraErreur(true)}
          >
            <View pointerEvents="none" style={s.cameraOverlay}>
              <View style={s.scanFrame}>
                <View style={[s.corner, s.topLeft]} />
                <View style={[s.corner, s.topRight]} />
                <View style={[s.corner, s.bottomLeft]} />
                <View style={[s.corner, s.bottomRight]} />
              </View>
              <Text style={s.cameraHint}>Lecture automatique du QR code</Text>
            </View>
          </CameraView>
        )}
        {busy ? (
          <View style={s.busyOverlay}>
            <ActivityIndicator size="large" color={theme.white} />
            <Text style={s.busyText}>Vérification du pointage…</Text>
          </View>
        ) : null}
      </View>
      <Text style={s.scanTip}>
        {scanContinu
          ? "Après confirmation du serveur, la caméra se réactive automatiquement."
          : "Chaque pointage reste soumis à la confirmation de l'agent."}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, padding: 12, gap: 9, backgroundColor: theme.paper },
  scanHeading: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: 10 },
  headingCopy: { flex: 1, gap: 3 },
  scanTitle: { color: theme.ink, fontSize: 22, fontWeight: "800", letterSpacing: -0.4 },
  scanSubtitle: { color: theme.inkSoft, fontSize: 13 },
  cameraToolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
  toolButton: { minHeight: 38, paddingHorizontal: 9, justifyContent: "center", borderRadius: 8, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.white },
  toolButtonActive: { borderColor: theme.accent, backgroundColor: theme.accent },
  toolButtonText: { color: theme.ink, fontSize: 10, fontWeight: "700" },
  toolButtonTextActive: { color: theme.white },
  zoomControls: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 7, borderRadius: 8, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.white },
  zoomButton: { width: 25, height: 28, alignItems: "center", justifyContent: "center" },
  zoomText: { color: theme.accent, fontSize: 21, fontWeight: "700" },
  zoomValue: { minWidth: 36, color: theme.inkSoft, fontSize: 10, fontWeight: "700", textAlign: "center" },
  cameraStage: { flex: 1, minHeight: 250, overflow: "hidden", borderRadius: 16, backgroundColor: theme.scanBg },
  camera: { flex: 1 },
  cameraOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 18 },
  scanFrame: { width: 236, height: 236 },
  corner: { position: "absolute", width: 34, height: 34, borderColor: "#FFFFFF" },
  topLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 7 },
  topRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 7 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 7 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 7 },
  cameraHint: { paddingHorizontal: 12, color: "#FFFFFF", fontSize: 13, fontWeight: "600", textAlign: "center" },
  cameraError: { flex: 1, alignItems: "center", justifyContent: "center", padding: 22, gap: 12 },
  cameraErrorTitle: { color: theme.white, fontSize: 17, fontWeight: "700" },
  retry: { minHeight: 42, paddingHorizontal: 18, justifyContent: "center", borderRadius: 8, backgroundColor: "#FFFFFF" },
  retryText: { color: theme.accent, fontWeight: "700" },
  busyOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: "rgba(10, 20, 32, 0.72)" },
  busyText: { color: theme.white, fontWeight: "700", fontSize: 14 },
  scanTip: { color: theme.inkSoft, fontSize: 11, lineHeight: 16, textAlign: "center" },
  resultScreen: { flex: 1, justifyContent: "center", padding: 18, backgroundColor: theme.paper },
  resultCard: { alignItems: "center", gap: 13, padding: 22, borderRadius: 16, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.white },
  statusMark: { width: 66, height: 66, borderRadius: 33, alignItems: "center", justifyContent: "center" },
  statusGlyph: { fontSize: 36, fontWeight: "800" },
  resultTitle: { fontSize: 21, fontWeight: "800", textAlign: "center", color: theme.ink },
  body: { color: theme.inkSoft, fontSize: 13, lineHeight: 19, textAlign: "center" },
  studentBlock: { width: "100%", gap: 5, padding: 14, borderRadius: 10, backgroundColor: "#F3F6FA" },
  fieldLabel: { color: theme.inkSoft, fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
  studentName: { color: theme.ink, fontSize: 18, fontWeight: "800", marginBottom: 8 },
  fieldValue: { color: theme.ink, fontSize: 14, fontWeight: "600" },
  candidateList: { width: "100%", gap: 8 },
  candidate: { minHeight: 50, justifyContent: "center", paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: theme.line, borderRadius: 9, backgroundColor: "#F3F6FA" },
  candidateCopy: { flex: 1, gap: 4 },
  candidateName: { color: theme.ink, fontSize: 13, fontWeight: "700" },
  candidateMeta: { color: theme.inkSoft, fontSize: 11 },
  primary: { width: "100%", minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 9, backgroundColor: theme.accent, marginTop: 4 },
  primaryText: { color: theme.white, fontSize: 14, fontWeight: "700" },
  secondary: { minHeight: 40, alignItems: "center", justifyContent: "center" },
  secondaryText: { color: theme.accent, fontSize: 13, fontWeight: "700" },
  autoNext: { color: theme.inkSoft, fontSize: 11, fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: theme.paper },
  permissionCard: { width: "100%", gap: 13, padding: 22, borderWidth: 1, borderColor: theme.line, borderRadius: 14, backgroundColor: theme.white },
});
