/**
 * Historique local de l'agent.
 * Ce registre est propre à l'appareil et n'est pas le registre global.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  historique,
  onFileChange,
  resumeLocal,
  synchroniserFile,
  type LocalItem,
  type ResumeLocal,
} from "../store/scan";
import { theme } from "../theme";

type FiltreStatut = "tous" | LocalItem["etat"];

const FILTRES: Array<{ id: FiltreStatut; label: string }> = [
  { id: "tous", label: "Tous" },
  { id: "confirme", label: "Confirmés" },
  { id: "en_attente", label: "En attente" },
  { id: "rejete", label: "Rejetés" },
];

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

function dateLisible(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function horodatageCourt(value: string | null) {
  if (!value) return "Aucune synchronisation enregistrée";
  return "Dernière tentative : " + dateLisible(value);
}

export function HistoriqueScreen() {
  const [items, setItems] = useState<LocalItem[]>([]);
  const [summary, setSummary] = useState<ResumeLocal | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [statut, setStatut] = useState<FiltreStatut>("tous");
  const [recherche, setRecherche] = useState("");
  const [coursRecherche, setCoursRecherche] = useState("");
  const [dateRecherche, setDateRecherche] = useState("");
  const mounted = useRef(true);

  const charger = useCallback(async (showLoading = true) => {
    if (showLoading && mounted.current) setLoading(true);
    try {
      const [recent, localSummary] = await Promise.all([historique(), resumeLocal()]);
      if (!mounted.current) return;
      setItems(recent);
      setSummary(localSummary);
      setMessage(null);
    } catch {
      if (mounted.current) {
        setMessage("Impossible de lire l'historique local. Ne désinstalle pas l'application avant d'avoir vérifié les données conservées.");
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void Promise.resolve().then(() => charger());
    const unsubscribe = onFileChange(() => void charger(false));
    return () => {
      mounted.current = false;
      unsubscribe();
    };
  }, [charger]);

  const filteredItems = useMemo(() => {
    const needle = recherche.trim().toLocaleLowerCase("fr");
    const courseNeedle = coursRecherche.trim().toLocaleLowerCase("fr");
    const dayNeedle = dateRecherche.trim();

    return items.filter((item) => {
      if (statut !== "tous" && item.etat !== statut) return false;
      if (needle) {
        const studentOrQr = [item.eleve, item.code_qr].filter(Boolean).join(" ").toLocaleLowerCase("fr");
        if (!studentOrQr.includes(needle)) return false;
      }
      if (courseNeedle) {
        const course = [item.cours_nom, item.cours].filter(Boolean).join(" ").toLocaleLowerCase("fr");
        if (!course.includes(courseNeedle)) return false;
      }
      if (dayNeedle && !item.at.startsWith(dayNeedle)) return false;
      return true;
    });
  }, [coursRecherche, dateRecherche, items, recherche, statut]);

  async function synchroniser() {
    if (syncing || !summary?.synchronisables) return;
    setSyncing(true);
    setMessage(null);
    try {
      const count = await synchroniserFile();
      setMessage(
        count > 0
          ? count + " pointage(s) confirmé(s) par le serveur."
          : "Aucun pointage confirmé. Les éléments non résolus restent en attente."
      );
      await charger(false);
    } catch {
      setMessage("Synchronisation interrompue. Les pointages non confirmés restent conservés.");
    } finally {
      if (mounted.current) setSyncing(false);
    }
  }

  return (
    <View style={s.root}>
      <View style={s.heading}>
        <Text style={s.title}>Historique</Text>
        <Text style={s.subtitle}>Les pointages enregistrés sur cet appareil, pas le registre global de l'établissement.</Text>
      </View>

      <View style={s.summary}>
        <View style={s.summaryCell}>
          <Text style={s.summaryNumber}>{summary?.total ?? 0}</Text>
          <Text style={s.summaryLabel}>Conservés</Text>
        </View>
        <View style={s.summaryCell}>
          <Text style={[s.summaryNumber, { color: theme.success }]}>{summary?.confirmes ?? 0}</Text>
          <Text style={s.summaryLabel}>Confirmés</Text>
        </View>
        <View style={s.summaryCell}>
          <Text style={[s.summaryNumber, { color: theme.warn }]}>{summary?.enAttente ?? 0}</Text>
          <Text style={s.summaryLabel}>En attente</Text>
        </View>
        <View style={s.summaryCell}>
          <Text style={[s.summaryNumber, { color: theme.danger }]}>{summary?.rejetes ?? 0}</Text>
          <Text style={s.summaryLabel}>Rejetés</Text>
        </View>
      </View>

      <Text style={s.syncMeta}>{horodatageCourt(summary?.derniereSynchronisation ?? null)}</Text>

      {message ? <Text style={s.message}>{message}</Text> : null}

      {summary && summary.synchronisables > 0 ? (
        <TouchableOpacity
          style={[s.syncButton, syncing && s.syncButtonDisabled]}
          onPress={() => void synchroniser()}
          disabled={syncing}
          accessibilityRole="button"
        >
          {syncing ? (
            <ActivityIndicator color={theme.white} />
          ) : (
            <Text style={s.syncText}>Synchroniser {summary.synchronisables} pointage(s)</Text>
          )}
        </TouchableOpacity>
      ) : summary && summary.enAttente > 0 ? (
        <Text style={s.pendingInfo}>
          {summary.enAttente} scan(s) en attente sans cours attribué. Un nouveau scan connecté est nécessaire pour que le serveur détermine le cours.
        </Text>
      ) : null}

      <View style={s.filters}>
        <TextInput
          style={s.input}
          value={recherche}
          onChangeText={setRecherche}
          placeholder="Élève ou code QR"
          placeholderTextColor={theme.inkSoft}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Rechercher un élève ou un code QR"
        />
        <TextInput
          style={s.input}
          value={coursRecherche}
          onChangeText={setCoursRecherche}
          placeholder="Cours"
          placeholderTextColor={theme.inkSoft}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Filtrer par cours"
        />
        <TextInput
          style={s.input}
          value={dateRecherche}
          onChangeText={setDateRecherche}
          placeholder="Date (AAAA-MM-JJ)"
          placeholderTextColor={theme.inkSoft}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Filtrer par date au format année-mois-jour"
        />
      </View>

      <View style={s.statusFilters}>
        {FILTRES.map((filter) => {
          const active = statut === filter.id;
          return (
            <TouchableOpacity
              key={filter.id}
              style={[s.filterChip, active && s.filterChipActive]}
              onPress={() => setStatut(filter.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[s.filterChipText, active && s.filterChipTextActive]}>{filter.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={s.listHeading}>
        <Text style={s.listTitle}>Résultats</Text>
        <Text style={s.listMeta}>{filteredItems.length} entrée(s) · 20 dernières conservées</Text>
      </View>

      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        style={s.list}
        contentContainerStyle={filteredItems.length === 0 ? s.emptyList : s.listContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => void charger()} tintColor={theme.accent} />
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={theme.accent} />
          ) : (
            <View style={s.empty}>
              <Text style={s.emptyTitle}>Aucun résultat</Text>
              <Text style={s.emptyText}>
                Essaie de modifier les filtres ou effectue un nouveau scan.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <View style={s.row}>
            <View style={s.rowMain}>
              <Text style={s.code} numberOfLines={1}>{item.eleve || item.code_qr}</Text>
              {item.eleve ? <Text style={s.date}>{item.code_qr}</Text> : null}
              {item.cours_nom ? <Text style={s.date}>{item.cours_nom}</Text> : null}
              <Text style={s.date}>{dateLisible(item.at)}</Text>
              {item.note ? <Text style={s.note}>{item.note}</Text> : null}
            </View>
            <View style={s.rowStatus}>
              <View style={[s.statusDot, { backgroundColor: ETAT_COULEUR[item.etat] }]} />
              <Text style={[s.status, { color: ETAT_COULEUR[item.etat] }]}>
                {ETAT_LIBELLE[item.etat]}
              </Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.paper, paddingHorizontal: 15, paddingTop: 15 },
  heading: { gap: 5, marginBottom: 12 },
  title: { color: theme.ink, fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { color: theme.inkSoft, fontSize: 12, lineHeight: 17 },
  summary: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 12,
    backgroundColor: theme.white,
  },
  summaryCell: { flex: 1, alignItems: "center", gap: 2 },
  summaryNumber: { color: theme.ink, fontSize: 20, fontWeight: "800", fontVariant: ["tabular-nums"] },
  summaryLabel: { color: theme.inkSoft, fontSize: 9, textAlign: "center" },
  syncMeta: { color: theme.inkSoft, fontSize: 10, marginTop: 7 },
  message: { color: theme.inkSoft, fontSize: 12, lineHeight: 17, marginTop: 8 },
  pendingInfo: { color: theme.warnInk, fontSize: 11, lineHeight: 16, marginTop: 8 },
  syncButton: {
    minHeight: 43,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 9,
    borderRadius: 9,
    backgroundColor: theme.accent,
  },
  syncButtonDisabled: { opacity: 0.6 },
  syncText: { color: theme.white, fontSize: 12, fontWeight: "700" },
  filters: { gap: 7, marginTop: 12 },
  input: {
    height: 40,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
    borderColor: theme.line,
    backgroundColor: theme.white,
    color: theme.ink,
    fontSize: 12,
  },
  statusFilters: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 9 },
  filterChip: { minHeight: 32, justifyContent: "center", paddingHorizontal: 11, borderRadius: 16, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.white },
  filterChipActive: { borderColor: theme.accent, backgroundColor: theme.accent },
  filterChipText: { color: theme.inkSoft, fontSize: 10, fontWeight: "700" },
  filterChipTextActive: { color: theme.white },
  listHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 15, marginBottom: 7 },
  listTitle: { color: theme.ink, fontSize: 14, fontWeight: "800" },
  listMeta: { color: theme.inkSoft, fontSize: 9 },
  list: { flex: 1 },
  listContent: { paddingBottom: 22 },
  emptyList: { flexGrow: 1, justifyContent: "center", paddingBottom: 25 },
  empty: { alignItems: "center", gap: 7, padding: 23, borderRadius: 12, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.white },
  emptyTitle: { color: theme.ink, fontSize: 14, fontWeight: "700" },
  emptyText: { color: theme.inkSoft, fontSize: 12, lineHeight: 18, textAlign: "center" },
  row: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 11, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.line, backgroundColor: theme.white },
  rowMain: { flex: 1, gap: 4 },
  code: { color: theme.ink, fontSize: 12, fontFamily: "monospace", fontWeight: "700" },
  date: { color: theme.inkSoft, fontSize: 10 },
  note: { color: theme.inkSoft, fontSize: 10 },
  rowStatus: { flexDirection: "row", alignItems: "center", gap: 5 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  status: { fontSize: 9, fontWeight: "800", letterSpacing: 0.2 },
});
