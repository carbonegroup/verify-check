/**
 * Accueil agent : aperçu local et raccourci vers le scanner.
 * Cet écran ne sert plus à choisir la classe ou le cours.
 */

import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { enAttente, historique, onFileChange, type LocalItem } from "../store/scan";
import { theme } from "../theme";

export type Selection = {
  classeId: string;
  classeNom: string;
  coursId: string;
  coursNom: string;
  salle?: string;
};

const ETATS: Record<LocalItem["etat"], { label: string; couleur: string }> = {
  en_attente: { label: "EN ATTENTE", couleur: theme.warn },
  confirme: { label: "CONFIRMÉ", couleur: theme.success },
  rejete: { label: "REJETÉ", couleur: theme.danger },
};

export function AccueilScreen({ onOpenScanner }: { onOpenScanner: () => void }) {
  const [items, setItems] = useState<LocalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  const charger = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    const [recent, pending] = await Promise.all([historique(), enAttente()]);
    setItems(recent);
    setPendingCount(pending);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;

    const chargerInitial = async () => {
      const [recent, pending] = await Promise.all([historique(), enAttente()]);
      if (!active) return;
      setItems(recent);
      setPendingCount(pending);
      setLoading(false);
    };

    void chargerInitial();
    const unsubscribe = onFileChange(() => void charger(false));

    return () => {
      active = false;
      unsubscribe();
    };
  }, [charger]);

  const pending = pendingCount;
  const confirms = items.filter((item) => item.etat === "confirme").length;

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={s.content}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={charger} tintColor={theme.accent} />
      }
    >
      <View style={s.heading}>
        <Text style={s.kicker}>ESPACE AGENT</Text>
        <Text style={s.title}>Votre activité</Text>
        <Text style={s.subtitle}>Résumé des 20 derniers pointages enregistrés sur cet appareil.</Text>
      </View>

      <TouchableOpacity
        style={s.primary}
        onPress={onOpenScanner}
        accessibilityRole="button"
      >
        <View style={s.primaryIcon}>
          <Text style={s.primaryGlyph}>▦</Text>
        </View>
        <View style={s.primaryCopy}>
          <Text style={s.primaryTitle}>Ouvrir le scanner</Text>
          <Text style={s.primarySubtitle}>Reprendre le pointage</Text>
        </View>
        <Text style={s.primaryArrow}>›</Text>
      </TouchableOpacity>

      <View style={s.stats}>
        <View style={s.stat}>
          <Text style={s.statValue}>{items.length}</Text>
          <Text style={s.statLabel}>Pointages visibles</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.stat}>
          <Text style={[s.statValue, { color: theme.success }]}>{confirms}</Text>
          <Text style={s.statLabel}>Confirmés</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.stat}>
          <Text style={[s.statValue, { color: pending ? theme.warn : theme.ink }]}>{pending}</Text>
          <Text style={s.statLabel}>En attente</Text>
        </View>
      </View>

      <View style={s.sectionHead}>
        <Text style={s.sectionTitle}>Activité récente</Text>
        <Text style={s.sectionMeta}>Sur cet appareil</Text>
      </View>

      {loading && items.length === 0 ? (
        <ActivityIndicator color={theme.accent} style={s.loader} />
      ) : items.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyTitle}>Aucun pointage pour le moment</Text>
          <Text style={s.emptyText}>Les résultats de vos scans apparaîtront ici.</Text>
        </View>
      ) : (
        items.slice(0, 5).map((item) => {
          const status = ETATS[item.etat];
          return (
            <View key={item.id} style={s.item}>
              <View style={s.itemCopy}>
                <Text style={s.itemCode} numberOfLines={1}>{item.eleve || item.code_qr}</Text>
                {item.eleve ? <Text style={s.itemDate}>{item.code_qr}</Text> : null}
                <Text style={s.itemDate}>
                  {new Date(item.at).toLocaleString("fr-FR", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
              <Text style={[s.itemStatus, { color: status.couleur }]}>{status.label}</Text>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.paper },
  content: { padding: 18, paddingBottom: 28, gap: 16 },
  heading: { gap: 5 },
  kicker: { color: theme.secondary, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  title: { color: theme.ink, fontSize: 27, fontWeight: "800", letterSpacing: -0.6 },
  subtitle: { color: theme.inkSoft, fontSize: 13, lineHeight: 19 },
  primary: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: theme.accent,
  },
  primaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  primaryGlyph: { color: theme.white, fontSize: 25, fontWeight: "700" },
  primaryCopy: { flex: 1, gap: 3 },
  primaryTitle: { color: theme.white, fontSize: 15, fontWeight: "800" },
  primarySubtitle: { color: "#D7E3F0", fontSize: 12 },
  primaryArrow: { color: theme.white, fontSize: 28, fontWeight: "300" },
  stats: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.line,
    backgroundColor: theme.white,
  },
  stat: { flex: 1, alignItems: "center", gap: 3 },
  statValue: { color: theme.ink, fontSize: 22, fontWeight: "800", fontVariant: ["tabular-nums"] },
  statLabel: { color: theme.inkSoft, fontSize: 10, textAlign: "center" },
  statDivider: { width: 1, height: 34, backgroundColor: theme.line },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { color: theme.ink, fontSize: 16, fontWeight: "800" },
  sectionMeta: { color: theme.inkSoft, fontSize: 11 },
  loader: { marginTop: 20 },
  empty: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.line,
    backgroundColor: theme.white,
    gap: 6,
  },
  emptyTitle: { color: theme.ink, fontSize: 14, fontWeight: "700" },
  emptyText: { color: theme.inkSoft, fontSize: 12, lineHeight: 18 },
  item: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.line,
    backgroundColor: theme.white,
  },
  itemCopy: { flex: 1, gap: 4 },
  itemCode: { color: theme.ink, fontSize: 13, fontWeight: "700", fontFamily: "monospace" },
  itemDate: { color: theme.inkSoft, fontSize: 11 },
  itemStatus: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
});
