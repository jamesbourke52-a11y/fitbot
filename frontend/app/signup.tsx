import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ImageBackground, ActivityIndicator, ScrollView,
} from "react-native";
import { useRouter, Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../src/auth";
import { colors } from "../src/theme";

export default function Signup() {
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const onSubmit = async () => {
    setErr("");
    if (!name || !email || !password) return setErr("All fields required");
    if (password.length < 6) return setErr("Password must be 6+ chars");
    setBusy(true);
    try {
      await register(name.trim(), email.trim(), password);
      router.replace("/");
    } catch (e: any) {
      setErr(e.message || "Sign up failed");
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
              <Text style={s.tagline}>Join the elite. Train smart.</Text>
            </View>
            <View style={s.card}>
              <Text style={s.h1}>Create account</Text>
              <Text style={s.sub}>Start your personalized journey today</Text>

              <Text style={s.label}>NAME</Text>
              <TextInput testID="signup-name" style={s.input} value={name} onChangeText={setName}
                placeholder="Your name" placeholderTextColor={colors.textDim} />

              <Text style={s.label}>EMAIL</Text>
              <TextInput testID="signup-email" style={s.input} value={email} onChangeText={setEmail}
                autoCapitalize="none" keyboardType="email-address"
                placeholder="you@email.com" placeholderTextColor={colors.textDim} />

              <Text style={s.label}>PASSWORD</Text>
              <TextInput testID="signup-password" style={s.input} value={password} onChangeText={setPassword}
                secureTextEntry placeholder="6+ characters" placeholderTextColor={colors.textDim} />

              {err ? <Text style={s.err} testID="signup-error">{err}</Text> : null}

              <TouchableOpacity testID="signup-submit" style={s.btn} onPress={onSubmit} disabled={busy}>
                {busy ? <ActivityIndicator color="#000" /> : <Text style={s.btnText}>Create account</Text>}
              </TouchableOpacity>

              <Link href="/login" asChild>
                <TouchableOpacity testID="goto-login" style={s.linkBtn}>
                  <Text style={s.linkText}>Already a member? <Text style={{ color: colors.primary }}>Sign in</Text></Text>
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
  brand: { alignItems: "center", marginBottom: 32 },
  logo: { color: colors.primary, fontSize: 36, fontWeight: "900", letterSpacing: 6 },
  tagline: { color: colors.textMuted, marginTop: 6, letterSpacing: 1 },
  card: { backgroundColor: "rgba(18,18,18,0.85)", borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 24 },
  h1: { color: colors.text, fontSize: 26, fontWeight: "700" },
  sub: { color: colors.textMuted, marginTop: 6, marginBottom: 16 },
  label: { color: colors.textDim, fontSize: 11, letterSpacing: 2, marginTop: 12, marginBottom: 6 },
  input: { backgroundColor: "#0A0A0A", borderColor: colors.border, borderWidth: 1, color: colors.text, padding: 16, borderRadius: 14, fontSize: 16 },
  err: { color: colors.error, marginTop: 12 },
  btn: { backgroundColor: colors.primary, padding: 16, borderRadius: 999, alignItems: "center", marginTop: 24 },
  btnText: { color: "#000", fontWeight: "800", fontSize: 16, letterSpacing: 1 },
  linkBtn: { alignItems: "center", marginTop: 16, padding: 8 },
  linkText: { color: colors.textMuted },
});
