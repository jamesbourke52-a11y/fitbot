import { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator,
  TextInput, Alert, Linking, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Sparkles, Check, LogOut, Tag } from "lucide-react-native";
import { useAuth, api } from "../src/auth";
import { colors } from "../src/theme";

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL!;

const PERKS = [
  "AI-personalized fitness plan tailored to your life",
  "Structured workout splits with exercise demos",
  "Personal AI coach — unlimited chat, 24/7",
  "Smart schedule that adapts around your work & sleep",
  "Water + calorie tracking with daily targets",
  "Curated supplement shop",
];

export default function Paywall() {
  const { token, logout, refreshSubscription } = useAuth();
  const router = useRouter();
  const [plan, setPlan] = useState<"monthly" | "yearly">("yearly");
  const [code, setCode] = useState("");
  const [codeStatus, setCodeStatus] = useState<null | { valid: boolean; discount?: number }>(null);
  const [busy, setBusy] = useState(false);

  const checkCode = async () => {
    if (!code.trim()) return setCodeStatus(null);
    try {
      const data = await api(token, "/api/subscription/promo/validate",
        { method: "POST", body: JSON.stringify({ code: code.trim() }) });
      setCodeStatus({ valid: !!data.valid, discount: data.discount_percent });
    } catch {
      setCodeStatus({ valid: false });
    }
  };

  const subscribe = async () => {
    setBusy(true);
    try {
      // Deployment-safe: on web use the browser origin directly; on native the
      // origin is not used by the checkout redirect (native returns via deep
      // link handled by the Stripe session's success/cancel URLs on backend).
      const origin = (typeof window !== "undefined" && window.location && window.location.origin)
        ? window.location.origin
        : "";
      const data = await api(token, "/api/subscription/checkout", {
        method: "POST",
        body: JSON.stringify({
          plan,
          origin,
          promo_code: codeStatus?.valid ? code.trim().toUpperCase() : undefined,
        }),
      });
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.location.href = data.url;
      } else {
        await Linking.openURL(data.url);
      }
    } catch (e: any) {
      Alert.alert("Error", e.message || "Could not start checkout");
    } finally {
      setBusy(false);
    }
  };

  const onLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const monthlyPrice = 6.99;
  const yearlyPrice = 67.10;
  const discount = codeStatus?.valid ? codeStatus.discount || 0 : 0;
  const finalAmount = plan === "monthly"
    ? monthlyPrice * (1 - discount / 100)
    : yearlyPrice * (1 - discount / 100);

  return (
    <SafeAreaView style={s.c} edges={["top"]}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.head}>
          <Sparkles color={colors.primary} size={20} />
          <Text style={s.kicker}>FITLUX PREMIUM</Text>
        </View>
        <Text style={s.title}>Unlock your full plan</Text>
        <Text style={s.subtitle}>One subscription · everything included · cancel anytime</Text>

        <View style={s.perks}>
          {PERKS.map((p, i) => (
            <View key={i} style={s.perkRow}>
              <Check color={colors.primary} size={16} />
              <Text style={s.perkText}>{p}</Text>
            </View>
          ))}
        </View>

        <View style={s.plans}>
          <TouchableOpacity
            testID="plan-yearly"
            style={[s.planCard, plan === "yearly" && s.planSelected]}
            onPress={() => setPlan("yearly")}
            activeOpacity={0.8}
          >
            <View style={s.bestBadge}>
              <Text style={s.bestBadgeText}>BEST VALUE · 20% OFF</Text>
            </View>
            <Text style={s.planLabel}>Yearly</Text>
            <Text style={s.planPrice}>$67.10<Text style={s.planUnit}>/year</Text></Text>
            <Text style={s.planSub}>≈ $5.59 / month · 365 days access</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="plan-monthly"
            style={[s.planCard, plan === "monthly" && s.planSelected]}
            onPress={() => setPlan("monthly")}
            activeOpacity={0.8}
          >
            <Text style={s.planLabel}>Monthly</Text>
            <Text style={s.planPrice}>$6.99<Text style={s.planUnit}>/month</Text></Text>
            <Text style={s.planSub}>30 days access · cancel anytime</Text>
          </TouchableOpacity>
        </View>

        <View style={s.codeBox}>
          <View style={s.codeHead}>
            <Tag color={colors.textMuted} size={14} />
            <Text style={s.codeLabel}>HAVE A PROMO CODE?</Text>
          </View>
          <View style={s.codeRow}>
            <TextInput
              testID="promo-input"
              style={s.codeInput}
              value={code}
              onChangeText={(t) => { setCode(t.toUpperCase()); setCodeStatus(null); }}
              placeholder="ENTER CODE"
              placeholderTextColor={colors.textDim}
              autoCapitalize="characters"
            />
            <TouchableOpacity testID="promo-apply" style={s.codeBtn} onPress={checkCode}>
              <Text style={s.codeBtnText}>Apply</Text>
            </TouchableOpacity>
          </View>
          {codeStatus?.valid && (
            <Text style={s.codeOk} testID="promo-ok">
              ✓ Code applied — {codeStatus.discount}% off
            </Text>
          )}
          {codeStatus && !codeStatus.valid && (
            <Text style={s.codeFail} testID="promo-bad">Invalid or expired code</Text>
          )}
        </View>

        <TouchableOpacity testID="subscribe-btn" style={s.cta} onPress={subscribe} disabled={busy}>
          {busy ? <ActivityIndicator color="#000" /> :
            <Text style={s.ctaText}>Subscribe — ${finalAmount.toFixed(2)}</Text>}
        </TouchableOpacity>

        <Text style={s.fine}>
          You'll be redirected to Stripe to complete payment. Test card: 4242 4242 4242 4242 · any future date · any CVC.
        </Text>

        <TouchableOpacity testID="logout-paywall" style={s.logoutRow} onPress={onLogout}>
          <LogOut color={colors.textDim} size={14} />
          <Text style={s.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 22, paddingBottom: 60 },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  kicker: { color: colors.primary, fontSize: 11, letterSpacing: 3, fontWeight: "800" },
  title: { color: colors.text, fontSize: 32, fontWeight: "900", marginTop: 8, lineHeight: 38 },
  subtitle: { color: colors.textMuted, marginTop: 6, marginBottom: 24 },
  perks: { gap: 10, marginBottom: 24 },
  perkRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  perkText: { color: colors.text, flex: 1, fontSize: 14 },
  plans: { gap: 12, marginBottom: 18 },
  planCard: { backgroundColor: colors.surface, padding: 18, borderRadius: 18, borderColor: colors.border, borderWidth: 2 },
  planSelected: { borderColor: colors.primary, backgroundColor: colors.primaryGlow },
  bestBadge: { backgroundColor: colors.primary, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, marginBottom: 6 },
  bestBadgeText: { color: "#000", fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  planLabel: { color: colors.textMuted, fontSize: 13, fontWeight: "700", letterSpacing: 1 },
  planPrice: { color: colors.text, fontSize: 30, fontWeight: "900", marginTop: 4 },
  planUnit: { color: colors.textMuted, fontSize: 14, fontWeight: "500" },
  planSub: { color: colors.textDim, fontSize: 12, marginTop: 4 },
  codeBox: { backgroundColor: colors.surface, padding: 14, borderRadius: 14, borderColor: colors.border, borderWidth: 1, marginBottom: 16 },
  codeHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  codeLabel: { color: colors.textMuted, fontSize: 11, letterSpacing: 2, fontWeight: "700" },
  codeRow: { flexDirection: "row", gap: 8 },
  codeInput: { flex: 1, backgroundColor: "#0A0A0A", color: colors.text, padding: 12, borderRadius: 10, borderColor: colors.border, borderWidth: 1, fontSize: 14, letterSpacing: 1 },
  codeBtn: { paddingHorizontal: 18, justifyContent: "center", borderRadius: 10, borderColor: colors.primary, borderWidth: 1 },
  codeBtnText: { color: colors.primary, fontWeight: "700" },
  codeOk: { color: colors.success, fontSize: 12, marginTop: 8, fontWeight: "600" },
  codeFail: { color: colors.error, fontSize: 12, marginTop: 8 },
  cta: { backgroundColor: colors.primary, padding: 18, borderRadius: 999, alignItems: "center", marginTop: 6 },
  ctaText: { color: "#000", fontSize: 17, fontWeight: "800", letterSpacing: 1 },
  fine: { color: colors.textDim, fontSize: 11, textAlign: "center", marginTop: 12, lineHeight: 16 },
  logoutRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 22, padding: 8 },
  logoutText: { color: colors.textDim, fontSize: 13 },
});
