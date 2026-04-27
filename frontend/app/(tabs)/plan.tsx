import { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl,
  TouchableOpacity, Image, Pressable, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Sparkles, Flame, Droplet, Play, ChevronDown, ChevronUp, ExternalLink } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useAuth, api } from "../../src/auth";
import { colors } from "../../src/theme";

type Exercise = {
  id: string; name: string; thumb: string; demo_url: string;
  sets_reps: string; tip: string;
};
type WorkoutDay = {
  day: string; title: string; focus: string; exercises: Exercise[];
};
type Plan = {
  plan_text: string;
  calorie_target: number;
  water_target_glasses: number;
  workout_schedule: WorkoutDay[];
  quiz: { goal: string; workout_days_per_week: number; activity_level: string; workout_style?: string };
};

function ExerciseRow({ ex }: { ex: Exercise }) {
  const onPress = () => Linking.openURL(ex.demo_url);
  return (
    <Pressable style={s.exRow} onPress={onPress} testID={`exercise-${ex.id}`}>
      <View style={s.exThumbWrap}>
        <Image source={{ uri: ex.thumb }} style={s.exThumb} />
        <View style={s.exPlayOverlay}>
          <Play color="#000" size={16} fill="#000" />
        </View>
      </View>
      <View style={{ flex: 1 }}>
        <View style={s.exHeadRow}>
          <Text style={s.exName} numberOfLines={1}>{ex.name}</Text>
          <ExternalLink color={colors.textDim} size={13} />
        </View>
        <Text style={s.exSets}>{ex.sets_reps}</Text>
        <Text style={s.exTip} numberOfLines={2}>{ex.tip}</Text>
      </View>
    </Pressable>
  );
}

function DayCard({ day, idx }: { day: WorkoutDay; idx: number }) {
  const [open, setOpen] = useState(idx === 0);
  return (
    <View style={s.dayCard}>
      <TouchableOpacity
        testID={`day-toggle-${idx}`}
        style={s.dayHead}
        onPress={() => setOpen(!open)}
        activeOpacity={0.7}
      >
        <View style={{ flex: 1 }}>
          <Text style={s.dayKicker}>{day.day} • {day.focus}</Text>
          <Text style={s.dayTitle}>{day.title}</Text>
        </View>
        {open ? <ChevronUp color={colors.primary} size={20} /> : <ChevronDown color={colors.primary} size={20} />}
      </TouchableOpacity>
      {open && (
        <View style={{ marginTop: 12, gap: 10 }}>
          {day.exercises.map((ex) => (
            <ExerciseRow key={ex.id} ex={ex} />
          ))}
        </View>
      )}
    </View>
  );
}

export default function PlanScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<"workouts" | "overview">("workouts");

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
        <Text style={s.subtitle}>
          {(plan.quiz.workout_style || "gym").toUpperCase()} · {plan.quiz.workout_days_per_week} days / week
        </Text>

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
            <Text style={s.metricVal}>{plan.workout_schedule?.length || 0}</Text>
            <Text style={s.metricLabel}>training days</Text>
          </View>
        </View>

        <View style={s.tabs}>
          <TouchableOpacity testID="tab-workouts" style={[s.tab, tab === "workouts" && s.tabActive]} onPress={() => setTab("workouts")}>
            <Text style={[s.tabText, tab === "workouts" && s.tabTextActive]}>Workouts</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="tab-overview" style={[s.tab, tab === "overview" && s.tabActive]} onPress={() => setTab("overview")}>
            <Text style={[s.tabText, tab === "overview" && s.tabTextActive]}>AI Overview</Text>
          </TouchableOpacity>
        </View>

        {tab === "workouts" ? (
          <>
            <Text style={s.demoHint}>Tap any exercise to watch a tutorial on YouTube ↗</Text>
            <View style={{ gap: 12 }}>
              {(plan.workout_schedule || []).map((d, i) => (
                <DayCard key={i} day={d} idx={i} />
              ))}
            </View>
          </>
        ) : (
          <View style={s.planBox}>
            <Text style={s.planText} testID="plan-text">{plan.plan_text}</Text>
          </View>
        )}

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
  subtitle: { color: colors.textMuted, marginTop: 4, marginBottom: 20, letterSpacing: 1 },
  metrics: { flexDirection: "row", gap: 10, marginBottom: 20 },
  metric: { flex: 1, backgroundColor: colors.surface, padding: 14, borderRadius: 16, borderColor: colors.border, borderWidth: 1, alignItems: "flex-start" },
  metricVal: { color: colors.text, fontSize: 22, fontWeight: "800", marginTop: 8 },
  metricLabel: { color: colors.textMuted, fontSize: 11, marginTop: 2, letterSpacing: 1 },
  tabs: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: 999, padding: 4, marginBottom: 16, borderColor: colors.border, borderWidth: 1 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: "center" },
  tabActive: { backgroundColor: colors.primary },
  tabText: { color: colors.textMuted, fontWeight: "700", fontSize: 13 },
  tabTextActive: { color: "#000" },
  demoHint: { color: colors.textDim, fontSize: 12, marginBottom: 12, fontStyle: "italic" },
  dayCard: { backgroundColor: colors.surface, padding: 16, borderRadius: 18, borderColor: colors.border, borderWidth: 1 },
  dayHead: { flexDirection: "row", alignItems: "center" },
  dayKicker: { color: colors.primary, fontSize: 11, letterSpacing: 2, fontWeight: "800" },
  dayTitle: { color: colors.text, fontSize: 19, fontWeight: "800", marginTop: 4 },
  exRow: { flexDirection: "row", gap: 12, padding: 10, backgroundColor: "#0A0A0A", borderRadius: 14, borderColor: colors.border, borderWidth: 1 },
  exThumbWrap: { width: 90, height: 80, borderRadius: 10, overflow: "hidden", backgroundColor: "#000", position: "relative" },
  exThumb: { width: "100%", height: "100%" },
  exPlayOverlay: { position: "absolute", right: 6, bottom: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  exHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  exName: { color: colors.text, fontWeight: "700", fontSize: 14, flex: 1, marginRight: 6 },
  exSets: { color: colors.primary, fontSize: 12, marginTop: 2, fontWeight: "700", letterSpacing: 0.5 },
  exTip: { color: colors.textMuted, fontSize: 11, marginTop: 4, lineHeight: 15 },
  planBox: { backgroundColor: colors.surface, padding: 20, borderRadius: 20, borderColor: colors.border, borderWidth: 1 },
  planText: { color: colors.text, fontSize: 14, lineHeight: 22 },
  empty: { color: colors.textMuted, fontSize: 16 },
  btn: { backgroundColor: colors.primary, padding: 16, paddingHorizontal: 32, borderRadius: 999 },
  btnText: { color: "#000", fontWeight: "800" },
  outlineBtn: { borderColor: colors.primary, borderWidth: 1, padding: 14, borderRadius: 999, alignItems: "center", marginTop: 20 },
  outlineText: { color: colors.primary, fontWeight: "700" },
});
