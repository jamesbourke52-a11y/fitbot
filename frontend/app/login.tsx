import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ImageBackground, ActivityIndicator, ScrollView,
} from "react-native";
import { useRouter, Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../src/auth";
import { colors } from "../src/theme";

export default function Login() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const onSubmit = async () => {
    setErr("");
    if (!email || !password) return setErr("Enter email and password");
    setBusy(true);
    try {
      await login(email.trim(), password);
      router.replace("/");
    } catch (e: any) {
      setErr(e.message || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ImageBackground
      source={{ uri: "https://images.pexels.com/photos/21031387/pexels-photo-21031387.jpeg" }}
      style={s.bg}
      blurRadius={2}
    >
      <View style={s.overlay} />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
            <View style={s.brand}>
              <Text style={s.logo}>FITLUX</Text>
              <Text style={s.tagline}>Your premium fitness coach</Text>
            </View>

            <View style={s.card}>
              <Text style={s.h1}>Welcome back</Text>
              <Text style={s.sub}>Sign in to continue your transformation</Text>

              <Text style={s.label}>EMAIL</Text>
              <TextInput
                testID="login-email"
                style={s.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="you@email.com"
                placeholderTextColor={colors.textDim}
              />

              <Text style={s.label}>PASSWORD</Text>
              <TextInput
                testID="login-password"
                style={s.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="••••••••"
                placeholderTextColor={colors.textDim}
              />

              {err ? <Text style={s.err} testID="login-error">{err}</Text> : null}

              <TouchableOpacity testID="login-submit" style={s.btn} onPress={onSubmit} disabled={busy}>
                {busy ? <ActivityIndicator color="#000" /> : <Text style={s.btnText}>Sign in</Text>}
              </TouchableOpacity>

              <Link href="/signup" asChild>
                <TouchableOpacity testID="goto-signup" style={s.linkBtn}>
                  <Text style={s.linkText}>
                    New here? <Text style={{ color: colors.primary }}>Create account</Text>
                  </Text>
                </TouchableOpacity>
              </Link>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.bg },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(5,5,5,0.78)" },
  scroll: { flexGrow: 1, padding: 24, justifyContent: "center" },
  brand: { alignItems: "center", marginBottom: 36 },
  logo: { color: colors.primary, fontSize: 36, fontWeight: "900", letterSpacing: 6 },
  tagline: { color: colors.textMuted, marginTop: 6, letterSpacing: 1 },
  card: { backgroundColor: "rgba(18,18,18,0.85)", borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 24 },
  h1: { color: colors.text, fontSize: 26, fontWeight: "700" },
  sub: { color: colors.textMuted, marginTop: 6, marginBottom: 24 },
  label: { color: colors.textDim, fontSize: 11, letterSpacing: 2, marginTop: 12, marginBottom: 6 },
  input: { backgroundColor: "#0A0A0A", borderColor: colors.border, borderWidth: 1, color: colors.text, padding: 16, borderRadius: 14, fontSize: 16 },
  err: { color: colors.error, marginTop: 12 },
  btn: { backgroundColor: colors.primary, padding: 16, borderRadius: 999, alignItems: "center", marginTop: 24 },
  btnText: { color: "#000", fontWeight: "800", fontSize: 16, letterSpacing: 1 },
  linkBtn: { alignItems: "center", marginTop: 16, padding: 8 },
  linkText: { color: colors.textMuted },
});
