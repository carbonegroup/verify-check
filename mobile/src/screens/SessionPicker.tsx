import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { getContexte, type Contexte } from "../services/api";
import { theme } from "../theme";
import type { Selection } from "./AccueilScreen";

type Props = {
  visible: boolean;
  current: Selection | null;
  onClose: () => void;
  onSelect: (selection: Selection) => void;
  onSessionExpiree: () => void;
};

export function SessionPicker(props: Props) {
  const currentKey = props.visible
    ? [
        props.current?.classeId ?? "",
        props.current?.coursId ?? "",
        props.current?.salle ?? "",
      ].join("|")
    : "hidden";

  return (
    <Modal
      visible={props.visible}
      transparent
      animationType="slide"
      onRequestClose={props.current ? props.onClose : () => undefined}
      statusBarTranslucent
    >
      <SessionPickerContent key={currentKey} {...props} />
    </Modal>
  );
}

function SessionPickerContent({
  visible,
  current,
  onClose,
  onSelect,
  onSessionExpiree,
}: Props) {
  const [contexte, setContexte] = useState<Contexte | null>(null);
  const [classeId, setClasseId] = useState<string | null>(current?.classeId ?? null);
  const [coursId, setCoursId] = useState<string | null>(current?.coursId ?? null);
  const [salle, setSalle] = useState(current?.salle ?? "");
  const [loading, setLoading] = useState(visible);
  const [erreur, setErreur] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!visible) return;
    let active = true;

    void getContexte()
      .then((result) => {
        if (!active) return;
        setLoading(false);
        if (!result.ok) {
          setErreur(
            result.error === "reseau"
              ? "Réseau indisponible. Vérifie la connexion puis réessaie."
              : "Impossible de charger les séances."
          );
          if (result.error === "session") onSessionExpiree();
          return;
        }

        setContexte(result.data);
        const classeInitiale =
          current?.classeId && result.data.classes.some((item) => item.id === current.classeId)
            ? current.classeId
            : null;
        setClasseId(classeInitiale);

        const coursInitial =
          current?.coursId &&
          result.data.cours.some(
            (item) =>
              item.id === current.coursId &&
              item.actif &&
              item.classe_id === classeInitiale
          )
            ? current.coursId
            : null;
        setCoursId(coursInitial);
      })
      .catch(() => {
        if (!active) return;
        setLoading(false);
        setErreur("Impossible de charger les séances.");
      });

    return () => {
      active = false;
    };
  }, [visible, current?.classeId, current?.coursId, onSessionExpiree, refreshKey]);

  const classes = contexte?.classes ?? [];
  const cours = (contexte?.cours ?? []).filter(
    (item) => item.actif && item.classe_id === classeId
  );
  const classeChoisie = classes.find((item) => item.id === classeId);
  const coursChoisi = cours.find((item) => item.id === coursId);
  const peutValider = Boolean(classeChoisie && coursChoisi);

  function choisirClasse(id: string) {
    setClasseId(id);
    setCoursId(null);
    setSalle("");
  }

  function valider() {
    if (!classeChoisie || !coursChoisi) return;
    onSelect({
      classeId: classeChoisie.id,
      classeNom: classeChoisie.nom,
      coursId: coursChoisi.id,
      coursNom: coursChoisi.nom,
      salle: salle.trim() || coursChoisi.salle || undefined,
    });
  }

  return (
    <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.handle} />
          <View style={s.heading}>
            <View style={s.headingCopy}>
              <Text style={s.title}>{current ? "Changer de séance" : "Choisir une séance"}</Text>
              <Text style={s.subtitle}>
                Sélectionne la classe et le cours avant de commencer le pointage.
              </Text>
            </View>
            {current ? (
              <TouchableOpacity
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Fermer la sélection"
                style={s.close}
              >
                <Text style={s.closeText}>×</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {loading ? (
            <View style={s.center}>
              <ActivityIndicator color={theme.accent} size="large" />
              <Text style={s.muted}>Chargement des séances…</Text>
            </View>
          ) : erreur ? (
            <View style={s.center}>
              <Text style={s.error}>{erreur}</Text>
              <TouchableOpacity
                style={s.retry}
                onPress={() => {
                  setErreur(null);
                  setLoading(true);
                  setRefreshKey((key) => key + 1);
                }}
                accessibilityRole="button"
              >
                <Text style={s.retryText}>Réessayer</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView
              style={s.scroll}
              contentContainerStyle={s.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={s.label}>CLASSE</Text>
              {classes.length ? (
                <View style={s.options}>
                  {classes.map((item) => {
                    const active = item.id === classeId;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => choisirClasse(item.id)}
                        style={[s.option, active && s.optionActive]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                      >
                        <Text style={[s.optionText, active && s.optionTextActive]}>
                          {item.nom}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <Text style={s.muted}>Aucune classe disponible.</Text>
              )}

              <Text style={s.label}>COURS ACTIFS</Text>
              {classeId && cours.length ? (
                <View style={s.courseList}>
                  {cours.map((item) => {
                    const active = item.id === coursId;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => { setCoursId(item.id); setSalle(item.salle ?? ""); }}
                        style={[s.course, active && s.courseActive]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                      >
                        <View style={s.courseCopy}>
                          <Text style={[s.courseName, active && s.optionTextActive]}>
                            {item.nom}
                          </Text>
                          <Text style={s.courseMeta}>
                            {item.heure_debut.slice(0, 5)}–{item.heure_fin.slice(0, 5)}
                            {item.salle ? " · " + item.salle : ""}
                          </Text>
                        </View>
                        <View style={[s.radio, active && s.radioActive]}>
                          {active ? <View style={s.radioDot} /> : null}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <Text style={s.muted}>
                  {classeId
                    ? "Aucun cours actif pour cette classe."
                    : "Choisis d’abord une classe."}
                </Text>
              )}

              <Text style={s.label}>SALLE (FACULTATIVE)</Text>
              <TextInput
                style={s.input}
                placeholder="Ex. S1"
                placeholderTextColor={theme.inkSoft}
                value={salle}
                onChangeText={setSalle}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </ScrollView>
          )}

          <View style={s.actions}>
            <TouchableOpacity
              style={[s.primary, !peutValider && s.primaryDisabled]}
              disabled={!peutValider || loading}
              onPress={valider}
              accessibilityRole="button"
            >
              <Text style={s.primaryText}>Utiliser cette séance</Text>
            </TouchableOpacity>
            {current ? (
              <TouchableOpacity style={s.cancel} onPress={onClose}>
                <Text style={s.cancelText}>Annuler</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(10, 24, 42, 0.42)",
  },
  sheet: {
    maxHeight: "90%",
    minHeight: "62%",
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 22,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: theme.paper,
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 4,
    backgroundColor: "#C7D1DE",
    alignSelf: "center",
    marginBottom: 18,
  },
  heading: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 16 },
  headingCopy: { flex: 1, gap: 5 },
  title: { color: theme.ink, fontSize: 23, lineHeight: 28, fontWeight: "800" },
  subtitle: { color: theme.inkSoft, fontSize: 13, lineHeight: 19 },
  close: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E7EDF4",
  },
  closeText: { color: theme.ink, fontSize: 26, lineHeight: 28 },
  scroll: { flexGrow: 0 },
  scrollContent: { gap: 11, paddingBottom: 8 },
  label: {
    marginTop: 7,
    color: theme.inkSoft,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: {
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 9,
    backgroundColor: theme.white,
  },
  optionActive: { borderColor: theme.accent, backgroundColor: theme.accent },
  optionText: { color: theme.ink, fontSize: 14, fontWeight: "600" },
  optionTextActive: { color: theme.white },
  courseList: { gap: 8 },
  course: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 13,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 10,
    backgroundColor: theme.white,
  },
  courseActive: { borderColor: theme.accent, backgroundColor: "#EAF1F8" },
  courseCopy: { flex: 1, gap: 4 },
  courseName: { color: theme.ink, fontSize: 14, fontWeight: "700" },
  courseMeta: { color: theme.inkSoft, fontSize: 12 },
  radio: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    borderRadius: 10,
    borderColor: "#9AAABC",
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: { borderColor: theme.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.accent },
  input: {
    height: 46,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderRadius: 9,
    borderColor: theme.line,
    backgroundColor: theme.white,
    color: theme.ink,
    fontSize: 14,
  },
  center: { minHeight: 180, alignItems: "center", justifyContent: "center", gap: 12, padding: 18 },
  muted: { color: theme.inkSoft, fontSize: 13, lineHeight: 19 },
  error: { color: theme.danger, textAlign: "center", fontSize: 13, lineHeight: 19 },
  retry: {
    minHeight: 42,
    paddingHorizontal: 18,
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: theme.accent,
  },
  retryText: { color: theme.white, fontWeight: "700" },
  actions: { gap: 9, paddingTop: 16 },
  primary: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: theme.accent,
  },
  primaryDisabled: { backgroundColor: "#AAB7C6" },
  primaryText: { color: theme.white, fontSize: 14, fontWeight: "700" },
  cancel: { minHeight: 40, alignItems: "center", justifyContent: "center" },
  cancelText: { color: theme.inkSoft, fontSize: 13, fontWeight: "600" },
});
