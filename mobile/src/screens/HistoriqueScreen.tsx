/**
 * Historique local de l’agent.
 * Les entrées sont celles conservées sur cet appareil ; elles ne représentent
 * pas un registre serveur global. Les états en attente restent visibles.
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

export function HistoriqueScreen() {
  const [items, setItems] = useState<LocalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setLoading(true);
    setItems(await historique());
    setLoading(false);
  }, []);

  useEffect(() => {
    void charger();
    return onFileChange(() => void charger());
  }, [charger]);

  const enAttente = items.filter((item) => item.etat === "en_attente").length;

  async function synchroniser() {
    if (syncing || enAttente === 0) return;
    setSyncing(true);
    setMessage(null);
    try {
      const count = await synchroniserFile();
      setMessage(
        count > 0
          ? count + " pointage(s) confirmé(s) par le serveur."
          : "Aucun pointage confirmé. Les éléments non synchronisés restent en attente."
      );
      await charger();
    } catch {
      setMessage("Synchronisation interrompue. Les pointages non confirmés restent conservés.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <View style={s.root}>
      <View style={s.heading}>
        <Text style={s.title}>Historique</Text>
        <Text style={s.subtitle}>Les pointages enregistrés sur cet appareil.</Text>
      </View>

      <View style={s.summary}>
        <View style={s.summaryCopy}>
          <Text style={s.summaryNumber}>{items.length}</Text>
          <Text style={s.summaryLabel}>Derniers pointages conservés</Text>
        </View>
        {enAttente > 0 ? (
          <View style={s.pending}>
            <View style={s.pendingDot} />
            <Text style={s.pendingText}>{enAttente} en attente</Text>
          </View>
        ) : (
          <View style={s.synced}>
            <Text style={s.syncedText}>À jour</Text>
          </View>
        )}
      </View>

      {message ? <Text style={s.message}>{message}</Text> : null}

      {enAttente > 0 ? (
        <TouchableOpacity
          style={[s.syncButton, syncing && s.syncButtonDisabled]}
          onPress={synchroniser}
          disabled={syncing}
          accessibilityRole="button"
        >
          {syncing ? (
            <ActivityIndicator color={theme.white} />
          ) : (
            <Text style={s.syncText}>Synchroniser les pointages en attente</Text>
          )}
        </TouchableOpacity>
      ) : null}

      <View style={s.listHeading}>
        <Text style={s.listTitle}>Pointages récents</Text>
        <Text style={s.listMeta}>Les 20 derniers</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        style={s.list}
        contentContainerStyle={items.length === 0 ? s.emptyList : s.listContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={charger} tintColor={theme.accent} />
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={theme.accent} />
          ) : (
            <View style={s.empty}>
              <Text style={s.emptyTitle}>Aucun pointage</Text>
              <Text style={s.emptyText}>
                Les scans validés ou en attente apparaîtront ici.
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
  root: { flex: 1, backgroundColor: theme.paper, paddingHorizontal: 17, paddingTop: 18 },
  heading: { gap: 5, marginBottom: 15 },
  title: { color: theme.ink, fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { color: theme.inkSoft, fontSize: 13 },
  summary: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 12,
    backgroundColor: theme.white,
  },
  summaryCopy: { gap: 2 },
  summaryNumber: { color: theme.ink, fontSize: 23, fontWeight: "800", fontVariant: ["tabular-nums"] },
  summaryLabel: { color: theme.inkSoft, fontSize: 11 },
  pending: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#FFF5E5",
  },
  pendingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.warn },
  pendingText: { color: theme.warnInk, fontSize: 11, fontWeight: "700" },
  synced: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, backgroundColor: "#E5F4EC" },
  syncedText: { color: theme.successInk, fontSize: 11, fontWeight: "700" },
  message: { color: theme.inkSoft, fontSize: 12, lineHeight: 18, marginTop: 10 },
  syncButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 11,
    borderRadius: 9,
    backgroundColor: theme.accent,
  },
  syncButtonDisabled: { opacity: 0.6 },
  syncText: { color: theme.white, fontSize: 13, fontWeight: "700" },
  listHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 21,
    marginBottom: 8,
  },
  listTitle: { color: theme.ink, fontSize: 15, fontWeight: "800" },
  listMeta: { color: theme.inkSoft, fontSize: 11 },
  list: { flex: 1 },
  listContent: { paddingBottom: 22 },
  emptyList: { flexGrow: 1, justifyContent: "center", paddingBottom: 25 },
  empty: {
    alignItems: "center",
    gap: 7,
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.line,
    backgroundColor: theme.white,
  },
  emptyTitle: { color: theme.ink, fontSize: 15, fontWeight: "700" },
  emptyText: { color: theme.inkSoft, fontSize: 12, lineHeight: 18, textAlign: "center" },
  row: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: theme.line,
    backgroundColor: theme.white,
  },
  rowMain: { flex: 1, gap: 4 },
  code: { color: theme.ink, fontSize: 13, fontFamily: "monospace", fontWeight: "700" },
  date: { color: theme.inkSoft, fontSize: 11 },
  note: { color: theme.inkSoft, fontSize: 11 },
  rowStatus: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  status: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
});
