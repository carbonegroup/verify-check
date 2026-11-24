/**
 * Écran de connexion — auth admin (email + mot de passe, Supabase Auth natif).
 * Le rôle admin est revérifié côté serveur à chaque appel API (RLS + Bearer).
 * Habillage Enterprise Light.
 */

import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { login } from "../services/auth";
import { theme } from "../theme";

const ERREURS: Record<string, string> = {
  identifiants: "Identifiants invalides.",
  role: "Ce compte n'est pas un compte admin.",
  champs: "Email et mot de passe requis.",
  reseau: "Réseau indisponible — réessaie.",
};

export function LoginScreen({ onConnecte }: { onConnecte: (email: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setErreur(null);
    const res = await login(email, password);
    setBusy(false);
    if (res.ok) onConnecte(res.email);
    else setErreur(ERREURS[res.error] ?? "Erreur — réessaie.");
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={s.card}>
        <Text style={s.brand}>VerifyCheck</Text>
        <Text style={s.subtitle}>Pointage scolaire · Conakry</Text>

        <Text style={s.label}>Email de la direction</Text>
        <TextInput
          style={s.input}
          placeholder="nom.ecole@exemple.gn"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={s.label}>Mot de passe</Text>
        <TextInput
          style={s.input}
          placeholder="••••••••"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {erreur ? <Text style={s.error}>{erreur}</Text> : null}

        <TouchableOpacity
          style={[s.button, busy && s.buttonBusy]}
          disabled={busy}
          onPress={submit}
          accessibilityLabel="Se connecter"
        >
          {busy ? (
            <ActivityIndicator color="#fff" size={16} />
          ) : (
            <Text style={s.buttonText}>Se connecter</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.paper,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.space.xl,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    gap: 12,
    padding: theme.space.lg,
    backgroundColor: theme.card,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.line,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  brand: {
    fontSize: theme.type.title,
    fontWeight: "700",
    color: theme.accent,
    textAlign: "center",
  },
  subtitle: {
    fontSize: theme.type.small,
    color: theme.inkSoft,
    textAlign: "center",
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: theme.inkSoft,
    marginTop: 6,
  },
  input: {
    height: 44,
    borderRadius: theme.radiusSm,
    borderWidth: 1,
    borderColor: theme.line,
    backgroundColor: theme.white,
    paddingHorizontal: 12,
    fontSize: theme.type.body,
    color: theme.ink,
  },
  error: {
    color: theme.danger,
    fontSize: theme.type.small,
    textAlign: "center",
  },
  button: {
    height: 44,
    borderRadius: theme.radiusSm,
    backgroundColor: theme.accent,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
  buttonBusy: {
    opacity: 0.7,
  },
  buttonText: { color: theme.white, fontWeight: "600", fontSize: theme.type.body },
});
