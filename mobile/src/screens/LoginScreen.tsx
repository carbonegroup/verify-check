/**
 * Écran de connexion — auth admin (email + mot de passe, Supabase Auth natif).
 * Le rôle admin est revérifié côté serveur à chaque appel API (RLS + Bearer).
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
        <TextInput
          style={s.input}
          placeholder="Email de la direction"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={s.input}
          placeholder="Mot de passe"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        {erreur ? <Text style={s.error}>{erreur}</Text> : null}
        <TouchableOpacity style={s.button} onPress={submit} disabled={busy} accessibilityLabel="Se connecter">
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Se connecter</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.paper,
    justifyContent: "center",
    padding: theme.space.xl,
  },
  card: {
    gap: 14,
    padding: 24,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 16,
    backgroundColor: theme.white,
  },
  brand: { fontSize: 28, fontWeight: "800", letterSpacing: -0.8, color: theme.navy },
  subtitle: { fontSize: theme.type.small, color: theme.inkSoft, marginBottom: 10 },
  input: {
    height: 50,
    borderRadius: theme.radiusSm,
    borderWidth: 1,
    borderColor: theme.line,
    backgroundColor: "#FAFCFE",
    paddingHorizontal: 14,
    fontSize: theme.type.body,
    color: theme.ink,
  },
  error: { color: theme.danger, fontSize: theme.type.small, lineHeight: 19 },
  button: {
    minHeight: 50,
    borderRadius: theme.radiusSm,
    backgroundColor: theme.navy,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  buttonText: { color: theme.white, fontWeight: "800", fontSize: theme.type.body },
});
