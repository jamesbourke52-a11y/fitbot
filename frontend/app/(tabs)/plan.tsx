import { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl,
  TouchableOpacity, Image, Pressable, Linking, Modal, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Sparkles, Flame, Droplet, Play, ChevronDown, ChevronUp, ExternalLink, Dumbbell, Zap, X, Check, History } from "lucide-react-native";
import { useRouter, useFocusEffect } from "expo-router";
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
  const [prescription, setPrescription] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [showFeedback, setShowFeedback] = useState(false);
  const [activeSession, setActiveSession] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [pl, pr, hi] = await Promise.all([
        api(token, "/api/plan"),
        api(token, "/api/workouts/prescription").catch(() => null),
        api(token, "/api/workouts/history?limit=10").catch(() => ({ sessions: [] })),
      ]);
      setPlan(pl);
      setPrescription(pr);
      setHistory(hi.sessions || []);
      setErr("");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

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

        {prescription && (
          <View style={s.rxCard}>
            <View style={s.rxHead}>
              <View style={{ flex: 1 }}>
                <Text style={s.rxKicker}>TODAY'S PRESCRIPTION · {prescription.level.emoji} {prescription.level.name.toUpperCase()}</Text>
                <Text style={s.rxTitle}>Lift {prescription.prescription.sets} sets of…</Text>
              </View>
              <View style={s.rxAdj}>
                <Zap color={colors.primary} size={12} />
                <Text style={s.rxAdjText}>×{prescription.prescription.adjustment_factor}</Text>
              </View>
            </View>
            {prescription.prescription.key_lifts.map((l: any) => (
              <Pressable
                key={l.id}
                style={s.rxRow}
                onPress={() => l.demo_url && Linking.openURL(l.demo_url)}
                testID={`rx-key-${l.id}`}
              >
                {l.thumb ? (
                  <View style={s.rxThumbWrap}>
                    <Image source={{ uri: l.thumb }} style={s.rxThumb} />
                    <View style={s.rxPlay}><Play color="#000" size={9} fill="#000" /></View>
                  </View>
                ) : (
                  <Dumbbell color={colors.primary} size={16} />
                )}
                <Text style={s.rxLiftName} numberOfLines={1}>{l.name}</Text>
                <Text style={s.rxLiftVal}>
                  {l.bodyweight ? `× ${l.reps}` :
                   l.weight_display ? `${l.weight_display}${l.weight_unit} × ${l.reps}` :
                   `× ${l.reps}`}
                </Text>
              </Pressable>
            ))}
            {prescription.prescription.accessories.map((a: any) => (
              <Pressable
                key={a.id}
                style={s.rxRow}
                onPress={() => a.demo_url && Linking.openURL(a.demo_url)}
                testID={`rx-acc-${a.id}`}
              >
                {a.thumb ? (
                  <View style={s.rxThumbWrap}>
                    <Image source={{ uri: a.thumb }} style={s.rxThumb} />
                    <View style={s.rxPlay}><Play color="#000" size={9} fill="#000" /></View>
                  </View>
                ) : (
                  <View style={{ width: 16, height: 16, borderRadius: 8, borderColor: colors.border, borderWidth: 1 }} />
                )}
                <Text style={s.rxLiftName} numberOfLines={1}>{a.name}</Text>
                <Text style={s.rxLiftVal}>× {a.reps}</Text>
              </Pressable>
            ))}
            <TouchableOpacity
              testID="start-workout-btn"
              style={s.rxStartBtn}
              onPress={async () => {
                try {
                  // Re-use existing session if one is awaiting feedback,
                  // otherwise start a new one before navigating.
                  let sid: string | null = prescription.current_session_id || null;
                  if (!sid) {
                    const r = await api(token, "/api/workouts/start", { method: "POST" });
                    sid = r.session_id;
                  }
                  router.push({ pathname: "/workout-session", params: { sessionId: sid || "" } });
                } catch (e: any) {
                  Alert.alert("Couldn't start", e.message);
                }
              }}
            >
              <Text style={s.rxStartText}>
                {prescription.awaiting_feedback ? "Resume workout" : "Start workout"}
              </Text>
            </TouchableOpacity>
            <Text style={s.rxFoot}>
              Weights auto-tune based on your last feedback. Too hard → we drop 5%. Too easy → we bump 5%.
            </Text>
          </View>
        )}

        {history.length > 0 && (
          <View style={s.histCard}>
            <View style={s.histHead}>
              <History color={colors.primary} size={16} />
              <Text style={s.histTitle}>Your last {history.length} session{history.length === 1 ? "" : "s"}</Text>
            </View>
            {history.slice(0, 10).map((h: any) => {
              const d = h.completed_at ? new Date(h.completed_at) : null;
              const when = d
                ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
                  " · " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
                : "—";
              const tag = h.weight_feedback === "too_easy"
                ? { label: "TOO EASY", color: "#22D3EE" }
                : h.weight_feedback === "too_hard"
                ? { label: "TOO HARD", color: colors.error }
                : { label: "JUST RIGHT", color: colors.success };
              return (
                <View key={h.id} style={s.histRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.histWhen}>{when}</Text>
                    {h.note ? <Text style={s.histNote} numberOfLines={2}>{h.note}</Text> : null}
                  </View>
                  <View style={[s.histTag, { borderColor: tag.color + "66", backgroundColor: tag.color + "1A" }]}>
                    <Text style={[s.histTagText, { color: tag.color }]}>{tag.label}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

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

      <FeedbackModal
        visible={showFeedback}
        token={token}
        sessionId={activeSession || prescription?.current_session_id}
        onClose={() => setShowFeedback(false)}
        onDone={async (res: any) => {
          setShowFeedback(false);
          if (res?.message) Alert.alert("Workout logged", `${res.message}\n+${res?.xp?.xp_delta || 0} XP`);
          const [pr, hi] = await Promise.all([
            api(token, "/api/workouts/prescription").catch(() => null),
            api(token, "/api/workouts/history?limit=10").catch(() => ({ sessions: [] })),
          ]);
          setPrescription(pr);
          setHistory(hi.sessions || []);
          setActiveSession(null);
        }}
      />
    </SafeAreaView>
  );
}

function FeedbackModal({ visible, token, sessionId, onClose, onDone }: any) {
  const [w, setW] = useState<string>("");
  const [r, setR] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!visible) { setW(""); setR(""); } }, [visible]);

  const submit = async () => {
    if (!w || !r || !sessionId) return;
    setSaving(true);
    try {
      const res = await api(token, "/api/workouts/feedback", {
        method: "POST",
        body: JSON.stringify({ workout_id: sessionId, weight_feedback: w, reps_feedback: r }),
      });
      onDone(res);
    } catch (e: any) { Alert.alert("Save failed", e.message); }
    setSaving(false);
  };

  const choice = (val: string, cur: string, setCur: (v: string) => void, labels: any) => (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {["too_easy", "just_right", "too_hard"].map((c) => (
        <TouchableOpacity
          key={c}
          testID={`fb-${labels.prefix}-${c}`}
          style={[s.fbBtn, cur === c && s.fbBtnActive]}
          onPress={() => setCur(c)}
        >
          <Text style={[s.fbBtnText, cur === c && s.fbBtnTextActive]}>
            {c === "too_easy" ? "Too easy" : c === "just_right" ? "Just right" : "Too hard"}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.modalBg}>
        <View style={s.modalCard}>
          <View style={s.modalHead}>
            <View>
              <Text style={s.modalKicker}>HOW WAS YOUR WORKOUT?</Text>
              <Text style={s.modalTitle}>Rate today's session</Text>
            </View>
            <TouchableOpacity onPress={onClose}><X color={colors.textMuted} size={22} /></TouchableOpacity>
          </View>

          <Text style={s.fbLabel}>WEIGHT</Text>
          {choice("w", w, setW, { prefix: "w" })}

          <Text style={[s.fbLabel, { marginTop: 16 }]}>REPS</Text>
          {choice("r", r, setR, { prefix: "r" })}

          <Text style={s.fbHint}>Next workout auto-tunes based on your answer (±5% per axis).</Text>
          <TouchableOpacity
            testID="submit-feedback"
            style={[s.submitBtn, (!w || !r) && s.submitBtnDisabled]}
            onPress={submit}
            disabled={!w || !r || saving}
          >
            {saving ? <ActivityIndicator color="#000" /> :
              <><Check color="#000" size={18} /><Text style={s.submitBtnText}>Save & finish</Text></>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
  rxCard: { backgroundColor: colors.surface, padding: 16, borderRadius: 20, borderColor: colors.primary, borderWidth: 1, marginBottom: 20 },
  rxHead: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  rxKicker: { color: colors.primary, fontSize: 10, letterSpacing: 2, fontWeight: "800" },
  rxTitle: { color: colors.text, fontSize: 18, fontWeight: "900", marginTop: 4 },
  rxAdj: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.primaryGlow, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderColor: colors.primary, borderWidth: 1 },
  rxAdjText: { color: colors.primary, fontWeight: "900", fontSize: 12 },
  rxRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomColor: colors.border, borderBottomWidth: 1 },
  rxLiftName: { color: colors.text, flex: 1, fontSize: 14 },
  rxLiftVal: { color: colors.primary, fontWeight: "900", fontSize: 14 },
  rxStartBtn: { backgroundColor: colors.primary, padding: 14, borderRadius: 12, marginTop: 12, alignItems: "center" },
  rxStartText: { color: "#000", fontWeight: "900", fontSize: 15 },
  rxThumbWrap: { width: 44, height: 36, borderRadius: 8, overflow: "hidden", backgroundColor: "#000", position: "relative" },
  rxThumb: { width: "100%", height: "100%" },
  rxPlay: { position: "absolute", right: 2, bottom: 2, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  rxFoot: { color: colors.textDim, fontSize: 11, marginTop: 10, textAlign: "center", fontStyle: "italic", lineHeight: 15 },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.surfaceElevated, padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderColor: colors.border, borderWidth: 1 },
  modalHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  modalKicker: { color: colors.primary, fontSize: 11, letterSpacing: 2, fontWeight: "800" },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: "900", marginTop: 2 },
  fbLabel: { color: colors.textDim, fontSize: 11, letterSpacing: 2, fontWeight: "800", marginBottom: 8 },
  fbBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, alignItems: "center" },
  fbBtnActive: { backgroundColor: colors.primaryGlow, borderColor: colors.primary },
  fbBtnText: { color: colors.textMuted, fontWeight: "700", fontSize: 12 },
  fbBtnTextActive: { color: colors.primary },
  fbHint: { color: colors.textDim, fontSize: 12, marginTop: 14, textAlign: "center" },
  submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary, padding: 14, borderRadius: 12, marginTop: 14 },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { color: "#000", fontWeight: "900", fontSize: 15 },
  exSets: { color: colors.primary, fontSize: 12, marginTop: 2, fontWeight: "700", letterSpacing: 0.5 },
  exTip: { color: colors.textMuted, fontSize: 11, marginTop: 4, lineHeight: 15 },
  planBox: { backgroundColor: colors.surface, padding: 20, borderRadius: 20, borderColor: colors.border, borderWidth: 1 },
  planText: { color: colors.text, fontSize: 14, lineHeight: 22 },
  empty: { color: colors.textMuted, fontSize: 16 },
  btn: { backgroundColor: colors.primary, padding: 16, paddingHorizontal: 32, borderRadius: 999 },
  btnText: { color: "#000", fontWeight: "800" },
  outlineBtn: { borderColor: colors.primary, borderWidth: 1, padding: 14, borderRadius: 999, alignItems: "center", marginTop: 20 },
  outlineText: { color: colors.primary, fontWeight: "700" },
  histCard: {
    backgroundColor: colors.surface, padding: 16, borderRadius: 18,
    borderColor: colors.border, borderWidth: 1, marginBottom: 20,
  },
  histHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  histTitle: { color: colors.text, fontSize: 14, fontWeight: "800", letterSpacing: 0.3 },
  histRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 10, borderBottomColor: colors.border, borderBottomWidth: 1,
  },
  histWhen: { color: colors.text, fontSize: 13, fontWeight: "700" },
  histNote: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  histTag: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1,
  },
  histTagText: { fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
});
