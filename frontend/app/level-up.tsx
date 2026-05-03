import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, Check, Zap, Lock, HelpCircle, X, Sparkles } from "lucide-react-native";
import { useAuth, api } from "../src/auth";
import { colors } from "../src/theme";

type Question = { id: string; question: string; options: { label: string; score: number }[] };

export default function LevelUp() {
  const { token } = useAuth();
  const router = useRouter();
  const [levels, setLevels] = useState<any[]>([]);
  const [me, setMe] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const [lv, m] = await Promise.all([
        api(token, "/api/levels"),
        api(token, "/api/me/level"),
      ]);
      setLevels(lv.levels);
      setMe(m);
    })();
  }, []);

  const setStart = async (id: number) => {
    const lv = levels.find((l) => l.id === id);
    Alert.alert(
      `Start at ${lv.name}?`,
      `${lv.desc}\n\nYour XP bar will be set to ${lv.min_xp}. You can still earn XP and climb higher.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm", onPress: async () => {
            setSaving(true);
            try {
              await api(token, "/api/me/prefs", { method: "PATCH", body: JSON.stringify({ starting_level: id }) });
              const m = await api(token, "/api/me/level");
              setMe(m);
            } catch (e: any) { Alert.alert("Save failed", e.message); }
            setSaving(false);
          },
        },
      ],
    );
  };

  if (!me || levels.length === 0) return <View style={s.center}><ActivityIndicator color={colors.primary} /></View>;

  return (
    <SafeAreaView style={s.c} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}>
          <ChevronLeft color={colors.text} size={22} />
        </TouchableOpacity>
        <Text style={s.title}>Your ranks</Text>
      </View>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.heroCard}>
          <Text style={{ fontSize: 48 }}>{me.level.emoji}</Text>
          <Text style={s.heroName}>{me.level.name}</Text>
          <Text style={s.heroDesc}>{me.level.desc}</Text>
          <View style={s.heroBar}>
            <View style={[s.heroFill, { width: `${me.progress_pct}%`, backgroundColor: me.level.color }]} />
          </View>
          <Text style={s.heroXP}>{me.xp} XP</Text>
          {me.next_level && (
            <Text style={s.heroNext}>
              <Zap color={colors.primary} size={12} /> {me.next_level.min_xp - me.xp} XP to unlock {me.next_level.emoji} {me.next_level.name}
            </Text>
          )}
        </View>

        <Text style={s.kicker}>CHOOSE YOUR STARTING DIFFICULTY</Text>
        <Text style={s.sub}>Pick the rank that matches your current fitness. You level up by logging progress and completing workouts.</Text>

        <TouchableOpacity style={s.assessBtn} onPress={() => setQuizOpen(true)}>
          <Sparkles color={colors.primary} size={18} />
          <View style={{ flex: 1 }}>
            <Text style={s.assessTitle}>Not sure? Take the 5-question assessment</Text>
            <Text style={s.assessSub}>We'll recommend your rank based on real experience</Text>
          </View>
        </TouchableOpacity>

        {levels.map((lv, idx) => {
          const unlocked = me.xp >= lv.min_xp;
          const current = me.level.id === lv.id;
          return (
            <TouchableOpacity
              key={lv.id}
              style={[s.levelRow, current && s.levelRowCurrent, !unlocked && s.levelRowLocked]}
              onPress={() => setStart(lv.id)}
              disabled={saving}
              activeOpacity={0.8}
            >
              <View style={[s.levelNum, { backgroundColor: unlocked ? lv.color : colors.surfaceElevated }]}>
                <Text style={s.levelNumText}>{lv.id}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={[s.levelName, !unlocked && { color: colors.textDim }]}>
                    {lv.emoji} {lv.name}
                  </Text>
                  {current && <View style={s.currentPill}><Text style={s.currentPillText}>CURRENT</Text></View>}
                </View>
                <Text style={s.levelDesc}>{lv.desc}</Text>
                <View style={s.intensityRow}>
                  <Text style={s.intensityLabel}>Intensity</Text>
                  <View style={s.intensityDots}>
                    {Array.from({ length: 10 }).map((_, i) => (
                      <View
                        key={i}
                        style={[s.intensityDot, i < lv.intensity && { backgroundColor: lv.color }]}
                      />
                    ))}
                  </View>
                </View>
                <Text style={[s.xpReq, !unlocked && { color: colors.textDim }]}>
                  {lv.min_xp === 0 ? "No XP required" : `${lv.min_xp} XP required`}
                </Text>
              </View>
              {unlocked ? <Check color={lv.color} size={20} /> : <Lock color={colors.textDim} size={18} />}
            </TouchableOpacity>
          );
        })}

        <View style={{ height: 30 }} />
        <View style={s.hint}>
          <Text style={s.hintTitle}>How XP works</Text>
          <Text style={s.hintLine}>• +25 XP per workout completed</Text>
          <Text style={s.hintLine}>• +50 XP per new strength PR 🏆</Text>
          <Text style={s.hintLine}>• +15 XP per progress photo uploaded</Text>
          <Text style={s.hintLine}>• +10 XP per body measurement logged</Text>
          <Text style={s.hintLine}>• +5 XP for opening the app daily</Text>
        </View>
      </ScrollView>

      <AssessmentModal
        visible={quizOpen}
        token={token}
        onClose={() => setQuizOpen(false)}
        onApplied={async () => {
          setQuizOpen(false);
          const m = await api(token, "/api/me/level");
          setMe(m);
        }}
      />
    </SafeAreaView>
  );
}

/* ---------- Assessment modal ---------- */
function AssessmentModal({ visible, token, onClose, onApplied }: any) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!visible) return;
    setAnswers({}); setResult(null); setStep(0);
    (async () => {
      setLoading(true);
      try {
        const data = await api(token, "/api/level/quiz");
        setQuestions(data.questions);
      } catch (e: any) { Alert.alert("Load failed", e.message); }
      setLoading(false);
    })();
  }, [visible]);

  const answer = (qid: string, idx: number) => {
    setAnswers({ ...answers, [qid]: idx });
    if (step + 1 < questions.length) {
      setStep(step + 1);
    } else {
      // Submit
      submit({ ...answers, [qid]: idx });
    }
  };

  const submit = async (a: Record<string, number>) => {
    setLoading(true);
    try {
      const res = await api(token, "/api/level/assess", {
        method: "POST",
        body: JSON.stringify({ answers: a, apply: false }),
      });
      setResult(res);
    } catch (e: any) { Alert.alert("Submit failed", e.message); }
    setLoading(false);
  };

  const apply = async () => {
    setApplying(true);
    try {
      await api(token, "/api/level/assess", {
        method: "POST",
        body: JSON.stringify({ answers, apply: true }),
      });
      onApplied();
    } catch (e: any) { Alert.alert("Apply failed", e.message); }
    setApplying(false);
  };

  const q = questions[step];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.modalBg}>
        <View style={s.modalCard}>
          <View style={s.modalHead}>
            <View>
              <Text style={s.modalKicker}>EXPERIENCE ASSESSMENT</Text>
              {!result && q && <Text style={s.modalStep}>Question {step + 1} of {questions.length}</Text>}
            </View>
            <TouchableOpacity onPress={onClose}><X color={colors.textMuted} size={22} /></TouchableOpacity>
          </View>

          {loading && <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />}

          {!loading && result && (
            <View>
              <Text style={[s.resultKicker]}>RECOMMENDED FOR YOU</Text>
              <View style={s.resultCard}>
                <Text style={{ fontSize: 56 }}>{result.recommended_level.emoji}</Text>
                <Text style={s.resultName}>{result.recommended_level.name}</Text>
                <Text style={s.resultDesc}>{result.recommended_level.desc}</Text>
                <View style={s.resultScore}>
                  <Text style={s.resultScoreLabel}>You scored</Text>
                  <Text style={s.resultScoreVal}>{result.total_score}/{result.max_score}</Text>
                </View>
              </View>
              <TouchableOpacity style={s.applyBtn} onPress={apply} disabled={applying}>
                {applying ? <ActivityIndicator color="#000" /> :
                  <><Check color="#000" size={18} /><Text style={s.applyBtnText}>Start at {result.recommended_level.name}</Text></>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setAnswers({}); setResult(null); setStep(0); }}>
                <Text style={s.retakeLink}>Retake the quiz</Text>
              </TouchableOpacity>
            </View>
          )}

          {!loading && !result && q && (
            <View>
              <View style={s.progressBar}>
                {questions.map((_: Question, i: number) => (
                  <View key={i} style={[s.progressSeg, i <= step && s.progressSegDone]} />
                ))}
              </View>
              <Text style={s.qTitle}>{q.question}</Text>
              {q.options.map((opt: any, idx: number) => (
                <TouchableOpacity key={idx} style={[s.optBtn, answers[q.id] === idx && s.optBtnActive]} onPress={() => answer(q.id, idx)}>
                  <Text style={[s.optText, answers[q.id] === idx && s.optTextActive]}>{opt.label}</Text>
                  {answers[q.id] === idx && <Check color={colors.primary} size={18} />}
                </TouchableOpacity>
              ))}
              {step > 0 && (
                <TouchableOpacity onPress={() => setStep(step - 1)} style={{ marginTop: 14, alignSelf: "center" }}>
                  <Text style={s.retakeLink}>Back</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
  title: { color: colors.text, fontSize: 24, fontWeight: "900" },
  content: { padding: 20, paddingBottom: 40 },
  heroCard: { backgroundColor: colors.surface, padding: 22, borderRadius: 22, borderColor: colors.primary, borderWidth: 2, alignItems: "center", marginBottom: 20 },
  heroName: { color: colors.text, fontSize: 28, fontWeight: "900", marginTop: 6 },
  heroDesc: { color: colors.textMuted, fontSize: 13, textAlign: "center", marginTop: 6, marginBottom: 14 },
  heroBar: { height: 10, width: "100%", backgroundColor: colors.surfaceElevated, borderRadius: 5, overflow: "hidden" },
  heroFill: { height: 10, borderRadius: 5 },
  heroXP: { color: colors.text, fontSize: 18, fontWeight: "900", marginTop: 10 },
  heroNext: { color: colors.primary, fontSize: 12, marginTop: 4, fontWeight: "700" },
  kicker: { color: colors.primary, letterSpacing: 2, fontSize: 11, fontWeight: "800", marginTop: 8 },
  sub: { color: colors.textMuted, marginTop: 6, marginBottom: 16, fontSize: 13, lineHeight: 20 },
  levelRow: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: colors.surface, padding: 16, borderRadius: 16, borderColor: colors.border, borderWidth: 1, marginBottom: 10 },
  levelRowCurrent: { borderColor: colors.primary, backgroundColor: colors.primaryGlow },
  levelRowLocked: { opacity: 0.65 },
  levelNum: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  levelNumText: { color: "#000", fontSize: 18, fontWeight: "900" },
  levelName: { color: colors.text, fontSize: 16, fontWeight: "900" },
  levelDesc: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  intensityRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  intensityLabel: { color: colors.textDim, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  intensityDots: { flexDirection: "row", gap: 3 },
  intensityDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  xpReq: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
  currentPill: { backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  currentPillText: { color: "#000", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  hint: { backgroundColor: colors.surface, padding: 16, borderRadius: 14, borderColor: colors.border, borderWidth: 1 },
  hintTitle: { color: colors.text, fontWeight: "800", marginBottom: 8 },
  hintLine: { color: colors.textMuted, fontSize: 13, marginBottom: 4 },

  assessBtn: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.primaryGlow, borderColor: colors.primary, borderWidth: 1, padding: 14, borderRadius: 14, marginBottom: 18 },
  assessTitle: { color: colors.text, fontWeight: "800", fontSize: 14 },
  assessSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },

  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.surfaceElevated, padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderColor: colors.border, borderWidth: 1, maxHeight: "92%" },
  modalHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  modalKicker: { color: colors.primary, fontSize: 11, letterSpacing: 2, fontWeight: "800" },
  modalStep: { color: colors.textMuted, fontSize: 12, marginTop: 2 },

  progressBar: { flexDirection: "row", gap: 4, marginBottom: 16 },
  progressSeg: { flex: 1, height: 4, backgroundColor: colors.surface, borderRadius: 2 },
  progressSegDone: { backgroundColor: colors.primary },
  qTitle: { color: colors.text, fontSize: 20, fontWeight: "800", marginBottom: 14, lineHeight: 28 },
  optBtn: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: colors.surface, padding: 14, borderRadius: 12, borderColor: colors.border, borderWidth: 1, marginBottom: 8 },
  optBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryGlow },
  optText: { color: colors.text, fontSize: 14, flex: 1 },
  optTextActive: { color: colors.primary, fontWeight: "700" },

  resultKicker: { color: colors.primary, fontSize: 11, letterSpacing: 2, fontWeight: "800", marginBottom: 10, textAlign: "center" },
  resultCard: { alignItems: "center", padding: 24, backgroundColor: colors.surface, borderRadius: 20, borderColor: colors.primary, borderWidth: 2, marginBottom: 14 },
  resultName: { color: colors.text, fontSize: 30, fontWeight: "900", marginTop: 6 },
  resultDesc: { color: colors.textMuted, textAlign: "center", marginTop: 8 },
  resultScore: { flexDirection: "row", gap: 8, alignItems: "center", marginTop: 14 },
  resultScoreLabel: { color: colors.textDim, fontSize: 13 },
  resultScoreVal: { color: colors.primary, fontSize: 18, fontWeight: "900" },
  applyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary, padding: 14, borderRadius: 12 },
  applyBtnText: { color: "#000", fontWeight: "900", fontSize: 15 },
  retakeLink: { color: colors.primary, textAlign: "center", marginTop: 14, fontSize: 13, fontWeight: "700" },
});
