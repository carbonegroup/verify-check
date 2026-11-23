/**
 * Écran de contexte de pointage (accueil) — données réelles de l'API :
 * classes + cours du jour (Conakry) avec statut actif. L'agent choisit le
 * contexte avant de scanner ; jamais de sélection arbitraire.
 */

import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { getContexte, type Contexte } from "../services/api";
import { theme } from "../theme";

export type Selection = {
  classeId: string;
  classeNom: string;
  coursId: string;
  coursNom: string;
  salle?: string;
};

export function AccueilScreen({
  onSelection,
  onLogout,
  email,
}: {
  onSelection: (s: Selection) => void;
  onLogout: () => void;
  email: string;
}) {
  const [ctx, setCtx] = useState<Contexte | null>(null);
  const [erreur, setErreur] = useState<"session" | "reseau" | "serveur" | null>(null);
  const [loading, setLoading] = useState(true);
  const [classeId, setClasseId] = useState<string | null>(null);
  const [coursId, setCoursId] = useState<string | null>(null);
  const [salle, setSalle] = useState("");

  const charger = useCallback(async () => {
    setLoading(true);
    setErreur(null);
    const res = await getContexte();
    setLoading(false);
    if (!res.ok) {
      setErreur(res.error);
      return;
    }
    setCtx(res.data);
    if (!classeId && res.data.classes.length > 0) setClasseId(res.data.classes[0].id);
  }, [classeId]);

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && !ctx) {
    return <Etat racine loading text="Chargement du contexte réel…" />;
  }
  if (erreur === "session") return <Etat racine erreur="Session expirée — reconnecte-toi." onAction={onLogout} action="Se reconnecter" />;
  if (erreur === "reseau") return <Etat racine erreur="Réseau indisponible." onAction={charger} action="Réessayer" />;
  if (erreur === "serveur" || !ctx) return <Etat racine erreur="Erreur serveur." onAction={charger} action="Réessayer" />;

  const classesActives = ctx.classes;
  const coursActifs = ctx.cours.filter((c) => c.actif && c.classe_id === classeId);
  const classe = classesActives.find((c) => c.id === classeId);
  const cours = coursActifs.find((c) => c.id === coursId);

  const ready = classeId && coursId;

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={s.content}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={charger} tintColor={theme.accent} />
      }
    >
      <View style={s.hero}>
        <Text style={s.eyebrow}>ESPACE DE POINTAGE</Text>
        <Text style={s.titre}>Choisir une séance</Text>
        <Text style={s.meta}>{ctx.jour} · {ctx.heure} · Conakry</Text>
        <Text style={s.account}>{email}</Text>
      </View>

      <View style={s.panel}>
        <Text style={s.label}>01  /  CLASSE</Text>
      {classesActives.length === 0 ? (
        <Text style={s.hint}>Aucune classe enregistrée. La direction doit créer les classes.</Text>
      ) : (
        <View style={s.groupe}>
          {classesActives.map((c) => (
            <Pill key={c.id} label={c.nom} actif={c.id === classeId} onPress={() => { setClasseId(c.id); setCoursId(null); }} />
          ))}
        </View>
      )}

      </View>

      <View style={s.panel}>
        <Text style={s.label}>02  /  COURS DU MOMENT</Text>
      {coursActifs.length === 0 ? (
        <Text style={s.hint}>Aucun cours actif pour cette classe maintenant : la direction doit mettre à jour le planning.</Text>
      ) : (
        <View style={s.groupe}>
          {coursActifs.map((c) => (
            <Pill
              key={c.id}
              label={`${c.nom} · ${c.heure_debut.slice(0, 5)}–${c.heure_fin.slice(0, 5)}${c.salle ? " · " + c.salle : ""}`}
              actif={c.id === coursId}
              onPress={() => setCoursId(c.id)}
            />
          ))}
        </View>
      )}

      </View>

      <View style={s.panel}>
        <Text style={s.label}>03  /  SALLE (FACULTATIF)</Text>
        <TextInput
          style={s.input}
          placeholder="Ex. B12"
          value={salle}
          onChangeText={setSalle}
          autoCapitalize="characters"
        />
      </View>

      <TouchableOpacity
        style={[s.bouton, !ready && s.boutonOff]}
        disabled={!ready}
        onPress={() =>
          classe &&
          cours &&
          onSelection({
            classeId: classe.id,
            classeNom: classe.nom,
            coursId: cours.id,
            coursNom: cours.nom,
            salle: salle.trim() || undefined,
          })
        }
      >
        <Text style={s.boutonTexte}>Commencer le pointage</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.deconnexion} onPress={onLogout}>
        <Text style={s.deconnexionTexte}>Se déconnecter</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Pill({ label, actif, onPress }: { label: string; actif: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[s.pill, actif && s.pillOn]} onPress={onPress}>
      <Text style={[s.pillText, actif && s.pillTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Etat({
  racine,
  loading,
  text,
  erreur,
  action,
  onAction,
}: {
  racine?: boolean;
  loading?: boolean;
  text?: string;
  erreur?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={[s.root, racine && { flex: 1, justifyContent: "center", padding: theme.space.xl }]}>
      {loading ? <ActivityIndicator color={theme.accent} /> : null}
      {text ? <Text style={s.meta}>{text}</Text> : null}
      {erreur ? <Text style={s.erreur}>{erreur}</Text> : null}
      {action && onAction ? (
        <TouchableOpacity style={s.bouton} onPress={onAction}>
          <Text style={s.boutonTexte}>{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.paper },
  content: { padding: theme.space.lg, paddingBottom: 28, gap: 14 },
  hero: { paddingTop: 5, paddingBottom: 7, gap: 5 },
  eyebrow: { color: theme.blue, fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
  titre: { fontSize: 27, fontWeight: "800", letterSpacing: -0.8, color: theme.ink },
  meta: { color: theme.inkSoft, fontSize: theme.type.small },
  account: { color: theme.muted, fontSize: 12, fontWeight: "600", marginTop: 2 },
  panel: {
    padding: theme.space.lg,
    gap: 12,
    backgroundColor: theme.white,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: theme.radius,
  },
  label: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: theme.inkSoft,
    fontWeight: "800",
  },
  hint: { color: theme.inkSoft, fontSize: theme.type.small, lineHeight: 19 },
  groupe: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    minHeight: 42,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: theme.radiusSm,
    borderWidth: 1,
    borderColor: theme.line,
    backgroundColor: "#FAFCFE",
    justifyContent: "center",
  },
  pillOn: { borderColor: theme.navy, backgroundColor: theme.navySoft },
  pillText: { color: theme.ink, fontSize: 13, fontWeight: "600" },
  pillTextOn: { color: theme.navy, fontWeight: "800" },
  input: {
    height: 46,
    borderRadius: theme.radiusSm,
    borderWidth: 1,
    borderColor: theme.line,
    backgroundColor: "#FAFCFE",
    paddingHorizontal: 13,
    color: theme.ink,
    fontSize: theme.type.body,
  },
  bouton: {
    minHeight: 50,
    borderRadius: theme.radiusSm,
    backgroundColor: theme.navy,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    paddingHorizontal: 16,
  },
  boutonOff: { backgroundColor: "#9AA8B8" },
  boutonTexte: { color: theme.white, fontWeight: "800", fontSize: 14 },
  deconnexion: { alignItems: "center", padding: 12 },
  deconnexionTexte: { color: theme.inkSoft, fontSize: 12, fontWeight: "600" },
  erreur: { color: theme.danger, fontSize: theme.type.small, textAlign: "center" },
});
