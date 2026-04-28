import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Check, X } from "lucide-react-native";
import { useAuth, api } from "../src/auth";
import { colors } from "../src/theme";

export default function SubscriptionSuccess() {
  const { token, refreshSubscription, refreshUser } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ session_id?: string }>();
  const [status, setStatus] = useState<"polling" | "success" | "failed">("polling");

  useEffect(() => {
    if (!params.session_id) {
      setStatus("failed");
      return;
    }
    let attempts = 0;
    const max = 12;
    const poll = async () => {
      attempts++;
      try {
        const data = await api(token, `/api/subscription/checkout/status/${params.session_id}`);
        if (data.payment_status === "paid" || data.subscription?.active) {
          await refreshSubscription();
          await refreshUser();
          setStatus("success");
          return;
        }
        if (attempts >= max) { setStatus("failed"); return; }
        setTimeout(poll, 2000);
      } catch {
        if (attempts >= max) { setStatus("failed"); return; }
        setTimeout(poll, 2000);
      }
    };
    poll();
  }, [params.session_id]);

  if (status === "polling") {
    return (
      <SafeAreaView style={s.c}>
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={s.title}>Confirming payment…</Text>
          <Text style={s.sub}>Hang tight, this takes a few seconds.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (status === "failed") {
    return (
      <SafeAreaView style={s.c}>
        <View style={s.center}>
          <View style={[s.icon, { backgroundColor: "#3a0e0e" }]}>
            <X color={colors.error} size={36} />
          </View>
          <Text style={s.title}>Payment not confirmed</Text>
          <Text style={s.sub}>Try again or contact support.</Text>
          <TouchableOpacity style={s.btn} onPress={() => router.replace("/paywall")}>
            <Text style={s.btnText}>Back to plans</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.c}>
      <View style={s.center}>
        <View style={s.icon}>
          <Check color={colors.primary} size={36} />
        </View>
        <Text style={s.title}>You're in 🎉</Text>
        <Text style={s.sub}>Welcome to FitLux Premium. Let's build your plan.</Text>
        <TouchableOpacity testID="continue-btn" style={s.btn} onPress={() => router.replace("/")}>
          <Text style={s.btnText}>Start the quiz</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30, gap: 14 },
  icon: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primaryGlow, alignItems: "center", justifyContent: "center", borderColor: colors.primary, borderWidth: 1, marginBottom: 6 },
  title: { color: colors.text, fontSize: 28, fontWeight: "900", textAlign: "center" },
  sub: { color: colors.textMuted, textAlign: "center", lineHeight: 22 },
  btn: { backgroundColor: colors.primary, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 999, marginTop: 14 },
  btnText: { color: "#000", fontWeight: "800", fontSize: 15, letterSpacing: 1 },
});
