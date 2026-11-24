/**
 * Scanner mobile : une seule tâche à l’écran.
 * Le résultat remplace la caméra après lecture ; aucun pointage n’est confirmé
 * avant la réponse du serveur. Les erreurs réseau restent EN ATTENTE.
 */

import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { enregistrerScan } from "../store/scan";
import { theme } from "../theme";
import type { ScanEtat } from "../lib/scanStatus";

const LIBELLES: Record<ScanEtat["kind"], { titre: string; detail: string; couleur: string }> = {
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
    detail: "Aucun cours actif ne correspond à cette heure.",
    couleur: theme.danger,
  },
  cours_ambigu: {
    titre: "Séance à vérifier",
    detail: "Plusieurs cours correspondent. Choisis la bonne séance puis réessaie.",
    couleur: theme.warn,
  },
  salle_invalide: {
    titre: "Salle ou cours incorrect",
    detail: "La salle ne correspond pas au cours sélectionné.",
    couleur: theme.warn,
  },
  session_expiree: {
    titre: "Session expirée",
    detail: "Reconnecte-toi pour continuer les pointages.",
    couleur: theme.danger,
  },
  erreur_serveur: {
    titre: "Validation impossible",
    detail: "Le serveur n’a pas confirmé ce pointage. Il reste en attente ou doit être réessayé.",
    couleur: theme.danger,
  },
  hors_ligne: {
    titre: "En attente de synchronisation",
    detail: "Le scan a été conservé sur cet appareil. Il ne sera confirmé qu’après validation du serveur.",
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
};

export function ScannerScreen({ onSessionExpiree }: { onSessionExpiree: () => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraErreur, setCameraErreur] = useState(false);
  const [resultat, setResultat] = useState<ResultatAffiche | null>(null);
  const [busy, setBusy] = useState(false);
  const scanBloque = useRef(false);

  const scanner = useCallback(async (
    code: string,
    selection?: { coursId: string; coursNom: string; salle?: string }
  ) => {
    const value = code.trim().toUpperCase();
    if (!value || busy || scanBloque.current) return;

    // Bloque immédiatement les événements caméra répétés pour le même QR.
    scanBloque.current = true;
    setBusy(true);

    try {
      const response = await enregistrerScan(value, selection);
      const affiche: ResultatAffiche = { kind: response.kind, code: value };
      if ("eleve" in response) affiche.eleve = response.eleve;
      if ("classe" in response) affiche.classe = response.classe;
      if ("cours" in response) affiche.cours = response.cours;
      if (response.kind === "pas_de_cours") affiche.heure = response.heure;
      if (response.kind === "cours_ambigu") affiche.candidates = response.candidates;
      setResultat(affiche);

      if (response.kind === "session_expiree") onSessionExpiree();
    } catch {
      setResultat({ kind: "erreur_serveur", code: value });
    } finally {
      setBusy(false);
    }
  }, [busy, onSessionExpiree]);

  const gererCodeBarres = useCallback((value: { data: string }) => {
    void scanner(value.data);
  }, [scanner]);

  function scannerSuivant() {
    setResultat(null);
    scanBloque.current = false;
  }

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
            VerifyCheck utilise la caméra uniquement pour lire les QR codes des cartes élèves.
          </Text>
          <TouchableOpacity style={s.primary} onPress={requestPermission}>
            <Text style={s.primaryText}>Autoriser la caméra</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (resultat) {
    const meta = LIBELLES[resultat.kind];
    const confirme = resultat.kind === "confirmee";

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
              {resultat.eleve ? <><Text style={s.fieldLabel}>ÉLÈVE</Text><Text style={s.studentName}>{resultat.eleve}</Text></> : null}
              {resultat.classe ? <><Text style={s.fieldLabel}>CLASSE</Text><Text style={s.fieldValue}>{resultat.classe}</Text></> : null}
              {resultat.cours ? <><Text style={s.fieldLabel}>COURS</Text><Text style={s.fieldValue}>{resultat.cours}</Text></> : null}
            </View>
          ) : null}

          {resultat.candidates?.length ? (
            <View style={s.candidateList}>
              <Text style={s.fieldLabel}>PLUSIEURS COURS SONT ACTIFS — CHOISIS LE BON</Text>
              {resultat.candidates.map((candidate) => (
                <TouchableOpacity
                  key={candidate.id}
                  style={s.candidate}
                  onPress={() => void scanner(resultat.code, { coursId: candidate.id, coursNom: candidate.nom })}
                  disabled={busy}
                  accessibilityRole="button"
                >
                  <View style={s.candidateCopy}>
                    <Text style={s.candidateName}>{candidate.nom}</Text>
                    <Text style={s.candidateMeta}>
                      {candidate.heure_debut && candidate.heure_fin
                        ? candidate.heure_debut.slice(0, 5) + "–" + candidate.heure_fin.slice(0, 5)
                        : "Cours actif"}
                      {candidate.salle ? " · " + candidate.salle : ""}
                    </Text>
                  </View>
                  <Text style={s.candidateArrow}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          {resultat.heure ? (
            <Text style={s.body}>Heure serveur : {resultat.heure}</Text>
          ) : null}

          {resultat.kind !== "cours_ambigu" ? (
            <TouchableOpacity style={s.primary} onPress={scannerSuivant} accessibilityRole="button">
              <Text style={s.primaryText}>Scanner le suivant</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={s.secondary} onPress={scannerSuivant}>
              <Text style={s.secondaryText}>Annuler ce scan</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <View style={s.scanHeading}>
        <Text style={s.scanTitle}>Scanner une carte</Text>
        <Text style={s.scanSubtitle}>Place le QR code dans le cadre.</Text>
      </View>

      <View style={s.cameraStage}>
        {cameraErreur ? (
          <View style={s.cameraError}>
            <Text style={s.cameraErrorTitle}>Caméra indisponible</Text>
            <Text style={s.cameraHint}>Vérifie l’autorisation et réessaie.</Text>
            <TouchableOpacity style={s.retry} onPress={() => setCameraErreur(false)}>
              <Text style={s.retryText}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <CameraView
            style={s.camera}
            facing="back"
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
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, padding: 12, gap: 10, backgroundColor: theme.paper },
  scanHeading: { gap: 3, paddingHorizontal: 4 },
  scanTitle: { color: theme.ink, fontSize: 22, fontWeight: "800", letterSpacing: -0.4 },
  scanSubtitle: { color: theme.inkSoft, fontSize: 13 },
  cameraStage: {
    flex: 1,
    minHeight: 300,
    overflow: "hidden",
    borderRadius: 16,
    backgroundColor: theme.scanBg,
  },
  camera: { flex: 1 },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
  },
  scanFrame: { width: 236, height: 236 },
  corner: { position: "absolute", width: 34, height: 34, borderColor: "#FFFFFF" },
  topLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 7 },
  topRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 7 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 7 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 7 },
  cameraHint: {
    paddingHorizontal: 12,
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  cameraError: { flex: 1, alignItems: "center", justifyContent: "center", padding: 22, gap: 12 },
  cameraErrorTitle: { color: theme.white, fontSize: 17, fontWeight: "700" },
  retry: { minHeight: 42, paddingHorizontal: 18, justifyContent: "center", borderRadius: 8, backgroundColor: "#FFFFFF" },
  retryText: { color: theme.accent, fontWeight: "700" },
  busyOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "rgba(10, 20, 32, 0.72)",
  },
  busyText: { color: theme.white, fontWeight: "700", fontSize: 14 },
  resultScreen: {
    flex: 1,
    justifyContent: "center",
    padding: 18,
    backgroundColor: theme.paper,
  },
  resultCard: {
    alignItems: "center",
    gap: 13,
    padding: 22,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.line,
    backgroundColor: theme.white,
  },
  statusMark: { width: 66, height: 66, borderRadius: 33, alignItems: "center", justifyContent: "center" },
  statusGlyph: { fontSize: 36, fontWeight: "800" },
  resultTitle: { fontSize: 21, fontWeight: "800", textAlign: "center", color: theme.ink },
  body: { color: theme.inkSoft, fontSize: 13, lineHeight: 19, textAlign: "center" },
  studentBlock: {
    width: "100%",
    gap: 5,
    padding: 14,
    borderRadius: 10,
    backgroundColor: "#F3F6FA",
  },
  fieldLabel: { color: theme.inkSoft, fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
  studentName: { color: theme.ink, fontSize: 18, fontWeight: "800", marginBottom: 8 },
  fieldValue: { color: theme.ink, fontSize: 14, fontWeight: "600" },
  candidateList: { width: "100%", gap: 8 },
  candidate: { minHeight: 56, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: theme.line, borderRadius: 9, backgroundColor: "#F3F6FA" },
  candidateCopy: { flex: 1, gap: 4 },
  candidateName: { color: theme.ink, fontSize: 14, fontWeight: "700" },
  candidateMeta: { color: theme.inkSoft, fontSize: 12 },
  candidateArrow: { color: theme.accent, fontSize: 24, fontWeight: "700" },
  primary: {
    width: "100%",
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: theme.accent,
    marginTop: 4,
  },
  primaryText: { color: theme.white, fontSize: 14, fontWeight: "700" },
  secondary: { minHeight: 40, alignItems: "center", justifyContent: "center" },
  secondaryText: { color: theme.accent, fontSize: 13, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: theme.paper },
  permissionCard: {
    width: "100%",
    gap: 13,
    padding: 22,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 14,
    backgroundColor: theme.white,
  },
});
