import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Sparkles, Flame, Droplet } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useAuth, api } from "../../src/auth";
import { colors } from "../../src/theme";

type Plan = {
  plan_text: string;
  calorie_target: number;
  water_target_glasses: number;
  quiz: { goal: string; workout_days_per_week: number; activity_level: string };
};

export default function PlanScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api(token, "/api/plan");
      setPlan(data); setErr("");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.primary} /></View>;

  if (err || !plan) {
    return (
      <SafeAreaView style={s.c}>
        <View style={s.center}>
          <Text style={s.empty}>No plan yet</Text>
          <TouchableOpacity style={s.btn} onPress={() => router.push("/quiz")}>
            <Text style={s.btnText}>Take the quiz</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.c} edges={["top"]}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
      >
        <View style={s.head}>
          <Sparkles color={colors.primary} size={20} />
          <Text style={s.kicker}>YOUR AI PLAN</Text>
        </View>
        <Text style={s.title}>Personalized for you</Text>
        <Text style={s.subtitle}>Crafted by Claude Sonnet 4.5 from your quiz answers</Text>

        <View style={s.metrics}>
          <View style={s.metric}>
            <Flame color={colors.primary} size={16} />
            <Text style={s.metricVal} testID="plan-calorie">{plan.calorie_target}</Text>
            <Text style={s.metricLabel}>kcal target</Text>
          </View>
          <View style={s.metric}>
            <Droplet color={colors.water} size={16} />
            <Text style={s.metricVal} testID="plan-water">{plan.water_target_glasses}</Text>
            <Text style={s.metricLabel}>glasses water</Text>
          </View>
          <View style={s.metric}>
            <Sparkles color={colors.primary} size={16} />
            <Text style={s.metricVal}>{plan.quiz.workout_days_per_week}</Text>
            <Text style={s.metricLabel}>days / week</Text>
          </View>
        </View>

        <View style={s.planBox}>
          <Text style={s.planText} testID="plan-text">{plan.plan_text}</Text>
        </View>

        <TouchableOpacity testID="retake-quiz" style={s.outlineBtn} onPress={() => router.push("/quiz")}>
          <Text style={s.outlineText}>Retake quiz & regenerate</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 60 },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  kicker: { color: colors.primary, fontSize: 11, letterSpacing: 3, fontWeight: "800" },
  title: { color: colors.text, fontSize: 30, fontWeight: "900", marginTop: 8 },
  subtitle: { color: colors.textMuted, marginTop: 4, marginBottom: 20 },
  metrics: { flexDirection: "row", gap: 10, marginBottom: 24 },
  metric: { flex: 1, backgroundColor: colors.surface, padding: 14, borderRadius: 16, borderColor: colors.border, borderWidth: 1, alignItems: "flex-start" },
  metricVal: { color: colors.text, fontSize: 22, fontWeight: "800", marginTop: 8 },
  metricLabel: { color: colors.textMuted, fontSize: 11, marginTop: 2, letterSpacing: 1 },
  planBox: { backgroundColor: colors.surface, padding: 20, borderRadius: 20, borderColor: colors.border, borderWidth: 1, marginBottom: 20 },
  planText: { color: colors.text, fontSize: 14, lineHeight: 22 },
  empty: { color: colors.textMuted, fontSize: 16 },
  btn: { backgroundColor: colors.primary, padding: 16, paddingHorizontal: 32, borderRadius: 999 },
  btnText: { color: "#000", fontWeight: "800" },
  outlineBtn: { borderColor: colors.primary, borderWidth: 1, padding: 14, borderRadius: 999, alignItems: "center" },
  outlineText: { color: colors.primary, fontWeight: "700" },
});
