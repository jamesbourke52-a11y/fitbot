import { useEffect, useState, useCallback, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Pressable,
  ActivityIndicator, Alert, Linking, Modal, Animated, Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  X, Play, Star, Check, ChevronDown, ChevronUp,
  Dumbbell, Flame, Trophy, ArrowRight, Sparkles,
} from "lucide-react-native";
import { useAuth, api } from "../src/auth";
import { colors } from "../src/theme";

type Lift = {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight_display?: number;
  weight_unit?: string;
  bodyweight?: boolean;
  thumb?: string;
  demo_url?: string;
  tip?: string;
};

type LogEntry = {
  exercise_id: string;
  completed: boolean;
  form_rating: number;
  difficulty: string;
  sets_done?: number | null;
  reps_done?: number | null;
};

const DIFFS = [
  { key: "too_easy",   label: "Too easy",   color: "#22D3EE" },
  { key: "just_right", label: "Just right", color: colors.success },
  { key: "too_hard",   label: "Too hard",   color: colors.error },
];

export default function WorkoutSessionScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const { sessionId: sessionIdParam } = useLocalSearchParams<{ sessionId?: string }>();
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(sessionIdParam || null);
  const [pres, setPres] = useState<any>(null);
  const [logs, setLogs] = useState<Record<string, LogEntry>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [coachReview, setCoachReview] = useState<any>(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      // Make sure we have a session
      let sid = sessionId;
      if (!sid) {
        const r = await api(token, "/api/workouts/start", { method: "POST" });
        sid = r.session_id;
        setSessionId(sid);
      }
      const pr = await api(token, "/api/workouts/prescription");
      setPres(pr);

      // Reload any existing logs for this session
      if (sid) {
        try {
          const sess = await api(token, `/api/workouts/session/${sid}`);
          const map: Record<string, LogEntry> = {};
          (sess?.exercises_log || []).forEach((e: any) => {
            map[e.exercise_id] = {
              exercise_id: e.exercise_id, completed: e.completed,
              form_rating: e.form_rating, difficulty: e.difficulty,
              sets_done: e.sets_done, reps_done: e.reps_done,
            };
          });
          setLogs(map);
        } catch {}
      }
    } catch (e: any) {
      Alert.alert("Couldn't open session", e.message);
      router.back();
    } finally {
      setLoading(false);
    }
  }, [token, sessionId, router]);

  useEffect(() => { load(); }, [load]);

  const allLifts: Lift[] = useMemo(() => {
    if (!pres) return [];
    return [
      ...(pres.prescription.key_lifts || []),
      ...(pres.prescription.accessories || []),
    ];
  }, [pres]);

  const doneCount = Object.values(logs).filter((l) => l.completed).length;
  const totalCount = allLifts.length;
  const progressPct = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);

  const saveLog = async (lift: Lift, partial: Partial<LogEntry>) => {
    if (!sessionId) return;
    const cur: LogEntry = logs[lift.id] || {
      exercise_id: lift.id, completed: false,
      form_rating: 3, difficulty: "just_right",
    };
    const merged: LogEntry = { ...cur, ...partial, exercise_id: lift.id };
    setLogs((p) => ({ ...p, [lift.id]: merged }));
    try {
      await api(token, "/api/workouts/exercise-log", {
        method: "POST",
        body: JSON.stringify({
          session_id: sessionId,
          exercise_id: lift.id,
          exercise_name: lift.name,
          completed: merged.completed,
          form_rating: merged.form_rating,
          difficulty: merged.difficulty,
          sets_done: merged.sets_done ?? null,
          reps_done: merged.reps_done ?? null,
        }),
      });
    } catch (e: any) {
      Alert.alert("Couldn't save", e.message);
    }
  };

  const finishWorkout = async () => {
    if (!sessionId) return;
    setFinishing(true);
    try {
      // Aggregate per-exercise difficulty into the summary feedback signal.
      // Majority vote; default just_right when nothing logged.
      const counts: Record<string, number> = { too_easy: 0, just_right: 0, too_hard: 0 };
      Object.values(logs).forEach((l) => { if (l.completed) counts[l.difficulty]++; });
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      const overall = top && top[1] > 0 ? top[0] : "just_right";

      const res = await api(token, "/api/workouts/feedback", {
        method: "POST",
        body: JSON.stringify({
          workout_id: sessionId,
          weight_feedback: overall,
          reps_feedback: overall,
        }),
      });

      // Compute fast client-side stats for the summary card
      const formAvg = doneCount === 0 ? 0 :
        Object.values(logs).filter((l) => l.completed)
          .reduce((s, l) => s + l.form_rating, 0) / doneCount;
      setSummary({
        ...res, doneCount, totalCount,
        formAvg: Number(formAvg.toFixed(1)),
        difficultyMix: counts,
      });
      setShowSummary(true);

      // Fire the AI coach review in the background (Claude ~15s)
      setReviewLoading(true);
      try {
        const rev = await api(token, `/api/coach/review-session/${sessionId}`, { method: "POST" });
        setCoachReview(rev);
      } catch (e) {
        // Non-fatal — summary modal still works without the review.
      } finally {
        setReviewLoading(false);
      }
    } catch (e: any) {
      Alert.alert("Couldn't finish", e.message);
    } finally {
      setFinishing(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.c} edges={["top", "bottom"]}>
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} />
          <Text style={s.loadingText}>Setting up your session…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.c} edges={["top", "bottom"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <X color={colors.textMuted} size={24} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.headerKicker}>WORKOUT IN PROGRESS</Text>
          <Text style={s.headerTitle}>
            {pres?.level?.emoji} {pres?.level?.name?.toUpperCase()} ·{" "}
            {pres?.style?.toUpperCase()} · {pres?.prescription?.sets} SETS
          </Text>
        </View>
      </View>

      <View style={s.progressWrap}>
        <View style={s.progressBar}>
          <Animated.View style={[s.progressFill, { width: `${progressPct}%` }]} />
        </View>
        <View style={s.progressRow}>
          <Text style={s.progressText}>
            <Text style={{ color: colors.primary, fontWeight: "900" }}>{doneCount}</Text>
            <Text style={{ color: colors.textMuted }}> / {totalCount} done</Text>
          </Text>
          <Text style={s.progressPct}>{progressPct}%</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {allLifts.map((lift, idx) => {
          const log = logs[lift.id];
          const isOpen = openId === lift.id;
          const isDone = !!log?.completed;
          return (
            <ExerciseCard
              key={lift.id}
              lift={lift}
              idx={idx}
              isOpen={isOpen}
              isDone={isDone}
              log={log}
              onToggle={() => setOpenId(isOpen ? null : lift.id)}
              onSave={(partial) => saveLog(lift, partial)}
            />
          );
        })}

        <TouchableOpacity
          style={[s.finishBtn, (finishing || doneCount === 0) && { opacity: 0.45 }]}
          onPress={finishWorkout}
          disabled={finishing || doneCount === 0}
          activeOpacity={0.85}
          testID="finish-workout-btn"
        >
          {finishing ? (
            <ActivityIndicator color="#000" />
          ) : (
            <>
              <Trophy color="#000" size={18} />
              <Text style={s.finishText}>
                {doneCount === totalCount ? "Crushed it · Finish" : "Finish & save"}
              </Text>
            </>
          )}
        </TouchableOpacity>
        <Text style={s.finishFoot}>
          You can finish early — only ticked exercises count toward your XP.
        </Text>
      </ScrollView>

      <SummaryModal
        visible={showSummary}
        summary={summary}
        review={coachReview}
        reviewLoading={reviewLoading}
        onClose={() => {
          setShowSummary(false);
          router.replace("/(tabs)/plan");
        }}
      />
    </SafeAreaView>
  );
}

function ExerciseCard({
  lift, idx, isOpen, isDone, log, onToggle, onSave,
}: {
  lift: Lift; idx: number; isOpen: boolean; isDone: boolean;
  log?: LogEntry;
  onToggle: () => void;
  onSave: (partial: Partial<LogEntry>) => void;
}) {
  const [form, setForm] = useState<number>(log?.form_rating ?? 0);
  const [diff, setDiff] = useState<string>(log?.difficulty || "");

  useEffect(() => {
    setForm(log?.form_rating ?? 0);
    setDiff(log?.difficulty || "");
  }, [log?.form_rating, log?.difficulty]);

  const targetText = lift.bodyweight
    ? `${lift.sets} × ${lift.reps} reps`
    : lift.weight_display
    ? `${lift.sets} × ${lift.reps} @ ${lift.weight_display} ${lift.weight_unit}`
    : `${lift.sets} × ${lift.reps}`;

  const tickOff = () => {
    if (form === 0) return; // require at least a form rating before completing
    if (!diff) return;
    onSave({ completed: true, form_rating: form, difficulty: diff });
    onToggle();
  };

  const undoTick = () => {
    onSave({ completed: false });
  };

  return (
    <View style={[s.exCard, isDone && s.exCardDone]}>
      <TouchableOpacity style={s.exHead} onPress={onToggle} activeOpacity={0.8}>
        <View style={s.exNumWrap}>
          {isDone
            ? <Check color="#000" size={18} />
            : <Text style={s.exNum}>{idx + 1}</Text>}
        </View>
        {lift.thumb ? (
          <View style={s.exThumbWrap}>
            <Image source={{ uri: lift.thumb }} style={s.exThumb} />
            <Pressable
              style={s.exPlay}
              onPress={(e) => {
                e.stopPropagation();
                if (lift.demo_url) Linking.openURL(lift.demo_url);
              }}
            >
              <Play color="#000" size={12} fill="#000" />
            </Pressable>
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={[s.exName, isDone && { color: colors.textMuted }]} numberOfLines={1}>
            {lift.name}
          </Text>
          <Text style={s.exTarget}>{targetText}</Text>
          {isDone && log ? (
            <View style={s.doneRow}>
              <Text style={s.doneTag}>★ {log.form_rating}/5</Text>
              <Text style={[s.doneTag, { color: colorForDiff(log.difficulty) }]}>
                {labelForDiff(log.difficulty)}
              </Text>
            </View>
          ) : null}
        </View>
        {isOpen ? <ChevronUp color={colors.textMuted} size={18} /> : <ChevronDown color={colors.textMuted} size={18} />}
      </TouchableOpacity>

      {isOpen && (
        <View style={s.exBody}>
          {lift.tip ? <Text style={s.exTip}>💡 {lift.tip}</Text> : null}

          <Text style={s.fbLabel}>HOW WAS YOUR FORM?</Text>
          <View style={s.starRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <TouchableOpacity
                key={n}
                style={s.starBtn}
                onPress={() => setForm(n)}
                hitSlop={6}
                testID={`form-star-${lift.id}-${n}`}
              >
                <Star
                  size={28}
                  color={n <= form ? colors.primary : colors.border}
                  fill={n <= form ? colors.primary : "transparent"}
                />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.starHint}>
            {form === 0 ? "Tap a star" :
             form <= 2 ? "Form needs work — slow it down" :
             form === 3 ? "Decent — keep dialling it in" :
             form === 4 ? "Solid form" : "Locked in 🔒"}
          </Text>

          <Text style={s.fbLabel}>DIFFICULTY</Text>
          <View style={s.diffRow}>
            {DIFFS.map((d) => (
              <TouchableOpacity
                key={d.key}
                style={[s.diffBtn, diff === d.key && { borderColor: d.color, backgroundColor: d.color + "1A" }]}
                onPress={() => setDiff(d.key)}
                testID={`diff-${lift.id}-${d.key}`}
              >
                <Text style={[s.diffText, diff === d.key && { color: d.color, fontWeight: "900" }]}>
                  {d.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={s.actionRow}>
            {isDone ? (
              <TouchableOpacity style={s.undoBtn} onPress={undoTick}>
                <Text style={s.undoText}>Undo</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[s.tickBtn, (form === 0 || !diff) && { opacity: 0.4 }]}
              onPress={tickOff}
              disabled={form === 0 || !diff}
              testID={`tick-${lift.id}`}
            >
              <Check color="#000" size={16} />
              <Text style={s.tickText}>{isDone ? "Update" : "Tick off"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

function SummaryModal({ visible, summary, review, reviewLoading, onClose }: any) {
  if (!summary) return null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.modalBg}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }}>
        <View style={s.modalCard}>
          <View style={s.modalGlow} />
          <View style={s.modalHead}>
            <Trophy color={colors.primary} size={26} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={s.modalKicker}>SESSION COMPLETE</Text>
              <Text style={s.modalTitle}>+{summary?.xp?.xp_delta || 0} XP earned</Text>
            </View>
          </View>

          <View style={s.statRow}>
            <View style={s.statBox}>
              <Text style={s.statVal}>{summary.doneCount}<Text style={s.statSlash}>/{summary.totalCount}</Text></Text>
              <Text style={s.statLabel}>EXERCISES</Text>
            </View>
            <View style={s.statBox}>
              <Text style={s.statVal}>{summary.formAvg.toFixed(1)}<Text style={s.statSlash}>/5</Text></Text>
              <Text style={s.statLabel}>AVG FORM</Text>
            </View>
            <View style={s.statBox}>
              <Text style={s.statVal}>×{summary.adjust_after?.toFixed?.(2) ?? "1.00"}</Text>
              <Text style={s.statLabel}>NEXT FACTOR</Text>
            </View>
          </View>

          {/* Coach's review — the star of the summary */}
          <View style={s.reviewCard}>
            <View style={s.reviewHead}>
              <Sparkles color={colors.primary} size={14} />
              <Text style={s.reviewKicker}>FITLUX COACH · DEBRIEF</Text>
            </View>
            {reviewLoading ? (
              <View style={{ paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
                <ActivityIndicator color={colors.primary} size="small" />
                <Text style={s.reviewLoading}>Coach is reviewing your ratings…</Text>
              </View>
            ) : review?.review ? (
              <>
                <Text style={s.reviewBody}>{review.review}</Text>
                {review.stats?.best && review.stats?.worst ? (
                  <View style={s.reviewChipRow}>
                    <View style={[s.reviewChip, { borderColor: colors.success + "66", backgroundColor: colors.success + "1A" }]}>
                      <Text style={[s.reviewChipLabel, { color: colors.success }]}>BEST</Text>
                      <Text style={s.reviewChipText} numberOfLines={1}>
                        {review.stats.best.name} · {review.stats.best.form}/5
                      </Text>
                    </View>
                    <View style={[s.reviewChip, { borderColor: colors.error + "66", backgroundColor: colors.error + "1A" }]}>
                      <Text style={[s.reviewChipLabel, { color: colors.error }]}>FOCUS</Text>
                      <Text style={s.reviewChipText} numberOfLines={1}>
                        {review.stats.worst.name} · {review.stats.worst.form}/5
                      </Text>
                    </View>
                  </View>
                ) : null}
              </>
            ) : (
              <Text style={s.reviewLoading}>{summary.message}</Text>
            )}
          </View>

          <TouchableOpacity style={s.modalBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={s.modalBtnText}>Back to plan</Text>
            <ArrowRight color="#000" size={16} />
          </TouchableOpacity>
        </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function colorForDiff(d: string) {
  if (d === "too_easy") return "#22D3EE";
  if (d === "too_hard") return colors.error;
  return colors.success;
}
function labelForDiff(d: string) {
  if (d === "too_easy") return "Too easy";
  if (d === "too_hard") return "Too hard";
  return "Just right";
}

const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: colors.textMuted, fontSize: 13 },
  header: { flexDirection: "row", alignItems: "center", padding: 16, borderBottomColor: colors.border, borderBottomWidth: 1 },
  headerKicker: { color: colors.primary, fontSize: 10, letterSpacing: 2.5, fontWeight: "900" },
  headerTitle: { color: colors.text, fontSize: 14, fontWeight: "900", marginTop: 3, letterSpacing: 0.5 },
  progressWrap: { padding: 16, gap: 6 },
  progressBar: { height: 8, borderRadius: 999, backgroundColor: colors.surface, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: colors.primary, borderRadius: 999 },
  progressRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progressText: { fontSize: 13 },
  progressPct: { color: colors.primary, fontSize: 13, fontWeight: "900" },
  scroll: { padding: 16, paddingBottom: 60, gap: 10 },
  exCard: { backgroundColor: colors.surface, borderRadius: 16, borderColor: colors.border, borderWidth: 1, overflow: "hidden" },
  exCardDone: { borderColor: colors.success + "55", backgroundColor: "rgba(16,185,129,0.05)" },
  exHead: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  exNumWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  exNum: { color: "#000", fontWeight: "900", fontSize: 14 },
  exThumbWrap: { width: 60, height: 50, borderRadius: 8, overflow: "hidden", backgroundColor: "#000", position: "relative" },
  exThumb: { width: "100%", height: "100%" },
  exPlay: { position: "absolute", right: 4, bottom: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  exName: { color: colors.text, fontWeight: "800", fontSize: 14 },
  exTarget: { color: colors.primary, fontSize: 12, fontWeight: "700", marginTop: 2 },
  doneRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  doneTag: { fontSize: 10, color: colors.primary, fontWeight: "900", letterSpacing: 0.5 },
  exBody: { paddingHorizontal: 14, paddingBottom: 14, gap: 8 },
  exTip: { color: colors.textMuted, fontSize: 12, fontStyle: "italic", lineHeight: 17, paddingVertical: 6 },
  fbLabel: { color: colors.textDim, fontSize: 10, letterSpacing: 2, fontWeight: "900", marginTop: 8 },
  starRow: { flexDirection: "row", gap: 8, justifyContent: "space-between", paddingVertical: 4 },
  starBtn: { padding: 4 },
  starHint: { color: colors.textMuted, fontSize: 11, fontStyle: "italic", textAlign: "center", marginTop: -2 },
  diffRow: { flexDirection: "row", gap: 8 },
  diffBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceElevated },
  diffText: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  undoBtn: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  undoText: { color: colors.textMuted, fontSize: 13, fontWeight: "700" },
  tickBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: 12, borderRadius: 12, backgroundColor: colors.primary },
  tickText: { color: "#000", fontWeight: "900", fontSize: 14 },
  finishBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: 999, backgroundColor: colors.primary, marginTop: 12 },
  finishText: { color: "#000", fontWeight: "900", fontSize: 15 },
  finishFoot: { color: colors.textDim, fontSize: 11, textAlign: "center", fontStyle: "italic", marginTop: 10 },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.surfaceElevated, padding: 22, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderColor: colors.primary, borderWidth: 1, overflow: "hidden" },
  modalGlow: { position: "absolute", top: -50, right: -50, width: 200, height: 200, borderRadius: 100, backgroundColor: colors.primaryGlow },
  modalHead: { flexDirection: "row", alignItems: "center", marginBottom: 18 },
  modalKicker: { color: colors.primary, fontSize: 11, letterSpacing: 2, fontWeight: "900" },
  modalTitle: { color: colors.text, fontSize: 22, fontWeight: "900", marginTop: 2 },
  statRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  statBox: { flex: 1, padding: 12, backgroundColor: colors.surface, borderRadius: 14, borderColor: colors.border, borderWidth: 1, alignItems: "flex-start" },
  statVal: { color: colors.text, fontSize: 20, fontWeight: "900" },
  statSlash: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  statLabel: { color: colors.textDim, fontSize: 9, letterSpacing: 1.5, fontWeight: "900", marginTop: 4 },
  modalMessage: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 20, fontStyle: "italic" },
  reviewCard: {
    backgroundColor: colors.surface, padding: 16, borderRadius: 16,
    borderColor: colors.primary, borderWidth: 1, marginBottom: 20,
  },
  reviewHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  reviewKicker: { color: colors.primary, fontSize: 10, letterSpacing: 2, fontWeight: "900" },
  reviewLoading: { color: colors.textMuted, fontSize: 12, fontStyle: "italic" },
  reviewBody: { color: colors.text, fontSize: 13, lineHeight: 20 },
  reviewChipRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  reviewChip: {
    flex: 1, borderRadius: 12, padding: 10, borderWidth: 1,
  },
  reviewChipLabel: { fontSize: 9, letterSpacing: 1.5, fontWeight: "900" },
  reviewChipText: { color: colors.text, fontSize: 11, fontWeight: "700", marginTop: 3 },
  modalBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.primary, padding: 14, borderRadius: 999 },
  modalBtnText: { color: "#000", fontWeight: "900", fontSize: 14 },
});
