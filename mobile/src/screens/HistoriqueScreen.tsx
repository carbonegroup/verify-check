/**
 * Écran historique mobile — pointages locaux de l'appareil avec états
 * explicites (EN ATTENTE / CONFIRMÉ / REJETÉ) et données serveur réelles
 * (compteurs par cours du jour). Aucune donnée inventée.
 */

import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { getDashboard, type DashboardData } from "../services/api";
import { historique, onFileChange, synchroniserFile, type LocalItem } from "../store/scan";
import { theme } from "../theme";

const ETAT_LIBELLE: Record<LocalItem["etat"], string> = {
  en_attente: "EN ATTENTE",
  confirme: "CONFIRMÉ",
  rejete: "REJETÉ",
};
const ETAT_COULEUR: Record<LocalItem["etat"], string> = {
  en_attente: theme.warn,
  confirme: theme.success,
  rejete: theme.danger,
};

export function HistoriqueScreen({ classeId, onSessionExpiree }: { classeId: string; onSessionExpiree: () => void }) {
  const [locaux, setLocaux] = useState<LocalItem[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [erreur, setErreur] = useState<"session" | "reseau" | "serveur" | null>(null);
  const [loading, setLoading] = useState(true);
  const [sync, setSync] = useState<number | null>(null);

  const charger = useCallback(async () => {
    setLoading(true);
    setErreur(null);
    setLocaux(await historique());
    const res = await getDashboard(classeId);
    setLoading(false);
    if (!res.ok) {
      setErreur(res.error);
      if (res.error === "session") onSessionExpiree();
      return;
    }
    setDashboard(res.data);
  }, [classeId, onSessionExpiree]);

  useEffect(() => {
    charger();
    return onFileChange(charger);
  }, [charger]);

  async function syncManuelle() {
    const n = await synchroniserFile();
    setSync(n);
  }

  const enAttente = locaux.filter((i) => i.etat === "en_attente").length;

  return (
    <View style={s.root}>
      <View style={s.entete}>
        <Text style={s.titre}>Historique</Text>
        {enAttente > 0 ? (
          <TouchableOpacity style={s.sync} onPress={syncManuelle}>
            <Text style={s.syncTexte}>Synchroniser ({enAttente} en attente)</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {sync !== null ? (
        <Text style={s.meta}>{sync > 0 ? `${sync} pointage(s) confirmé(s) par le serveur.` : "Rien à synchroniser ou réseau indisponible."}</Text>
      ) : null}

      {erreur && !dashboard ? (
        <Text style={s.erreur}>
          {erreur === "reseau" ? "Réseau indisponible — l'historique local reste affiché." : "Erreur serveur."}
        </Text>
      ) : null}

      {dashboard ? (
        <View style={s.cours}>
          {dashboard.cours_prevus.map((c) => {
            const presents = dashboard.eleves.filter((e) => e.presences.some((p) => p.course_id === c.id)).length;
            return (
              <View key={c.id} style={s.coursLigne}>
                <Text style={s.coursNom}>{c.nom}</Text>
                <Text style={s.coursCompte}>
                  {presents}/{dashboard.effectif} présents
                </Text>
              </View>
            );
          })}
          {dashboard.cours_prevus.length === 0 ? (
            <Text style={s.meta}>Aucun cours prévu aujourd'hui.</Text>
          ) : null}
        </View>
      ) : null}

      {loading && locaux.length === 0 ? <ActivityIndicator color={theme.accent} /> : null}

      <FlatList
        data={locaux}
        keyExtractor={(i) => i.id}
        ListEmptyComponent={<View style={s.empty}><Text style={s.emptyTitle}>Aucun pointage local</Text><Text style={s.meta}>Les scans effectués sur cet appareil apparaîtront ici.</Text></View>}
        contentContainerStyle={s.listContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={charger} tintColor={theme.accent} />}
        renderItem={({ item }) => (
          <View style={s.ligne}>
            <View>
              <Text style={s.code}>{item.code_qr}</Text>
              <Text style={s.meta}>{new Date(item.at).toLocaleString()}</Text>
              {item.note ? <Text style={s.meta}>{item.note}</Text> : null}
            </View>
            <Text style={[s.etat, { color: ETAT_COULEUR[item.etat] }]}>{ETAT_LIBELLE[item.etat]}</Text>
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.paper, paddingHorizontal: theme.space.lg, paddingTop: theme.space.lg, gap: 13 },
  entete: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  titre: { fontSize: 25, fontWeight: "800", letterSpacing: -0.6, color: theme.ink },
  sync: {
    minHeight: 40,
    borderRadius: theme.radiusSm,
    borderWidth: 1,
    borderColor: theme.navy,
    backgroundColor: theme.navySoft,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  syncTexte: { color: theme.navy, fontWeight: "800", fontSize: 11 },
  meta: { color: theme.inkSoft, fontSize: theme.type.small, lineHeight: 18 },
  erreur: { color: theme.danger, fontSize: theme.type.small, padding: 10, backgroundColor: "#FFF1F1", borderRadius: 8 },
  cours: {
    gap: 0,
    padding: theme.space.md,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: theme.radius,
    backgroundColor: theme.white,
  },
  coursLigne: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F6",
  },
  coursNom: { flex: 1, color: theme.ink, fontSize: 13, fontWeight: "600" },
  coursCompte: { color: theme.inkSoft, fontSize: 11, fontVariant: ["tabular-nums"] },
  listContent: { flexGrow: 1, paddingBottom: 22 },
  ligne: {
    minHeight: 66,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.white,
    borderRadius: theme.radiusSm,
    borderWidth: 1,
    borderColor: theme.line,
    paddingHorizontal: 13,
    paddingVertical: 10,
    marginBottom: 8,
  },
  code: { color: theme.ink, fontFamily: "monospace", fontSize: 12, fontWeight: "700" },
  etat: { fontWeight: "800", fontSize: 10, letterSpacing: 0.3 },
  empty: { marginTop: 8, padding: theme.space.xl, alignItems: "center", gap: 5, borderWidth: 1, borderStyle: "dashed", borderColor: theme.line, borderRadius: theme.radius },
  emptyTitle: { color: theme.ink, fontWeight: "800", fontSize: 13 },
});
