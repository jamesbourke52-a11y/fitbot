import { useEffect, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LogOut } from "lucide-react-native";
import { useAuth, api } from "../src/auth";
import { colors } from "../src/theme";

type Choice = { value: string; label: string };

// Convert user-friendly time strings like "6pm", "6:30pm", "18:00" to "HH:MM"
function normalizeTime(input: string): string | null {
  if (!input) return null;
  const cleaned = input.trim().toLowerCase().replace(/\s+/g, "");
  // 24h "HH:MM" or "H:MM"
  const m24 = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    const h = parseInt(m24[1], 10), m = parseInt(m24[2], 10);
    if (h >= 0 && h < 24 && m >= 0 && m < 60) return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  }
  // 12h "6pm" / "6:30am" / "12am"
  const m12 = cleaned.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)$/);
  if (m12) {
    let h = parseInt(m12[1], 10);
    const m = m12[2] ? parseInt(m12[2], 10) : 0;
    if (h < 1 || h > 12 || m < 0 || m > 59) return null;
    if (m12[3] === "pm" && h !== 12) h += 12;
    if (m12[3] === "am" && h === 12) h = 0;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  }
  // Bare "6" → "06:00", "18" → "18:00"
  const mh = cleaned.match(/^(\d{1,2})$/);
  if (mh) {
    const h = parseInt(mh[1], 10);
    if (h >= 0 && h < 24) return `${h.toString().padStart(2, "0")}:00`;
  }
  return null;
}

const STEPS = [
  { key: "age", title: "How old are you?", type: "number", placeholder: "28" },
  { key: "gender", title: "Gender", type: "choice", options: [
    { value: "male", label: "Male" }, { value: "female", label: "Female" }, { value: "other", label: "Other" }] },
  { key: "height_cm", title: "Height (cm)", type: "number", placeholder: "175" },
  { key: "weight_kg", title: "Weight (kg)", type: "number", placeholder: "72" },
  { key: "goal", title: "Your goal?", type: "choice", options: [
    { value: "lose_weight", label: "Lose weight" },
    { value: "gain_muscle", label: "Build muscle" },
    { value: "maintain", label: "Stay healthy" },
    { value: "athletic", label: "Athletic performance" }] },
  { key: "activity_level", title: "Activity level", type: "choice", options: [
    { value: "sedentary", label: "Sedentary (desk job)" },
    { value: "light", label: "Light (1-3 d/w)" },
    { value: "moderate", label: "Moderate (3-5 d/w)" },
    { value: "very_active", label: "Very active (6+ d/w)" }] },
  { key: "workout_days_per_week", title: "Workout days/week?", type: "choice", options: [
    { value: "2", label: "2 days" }, { value: "3", label: "3 days" },
    { value: "4", label: "4 days" }, { value: "5", label: "5 days" }, { value: "6", label: "6 days" }] },
  { key: "workout_style", title: "Preferred workout style?", type: "choice", options: [
    { value: "gym", label: "Gym (weights)" },
    { value: "calisthenics", label: "Calisthenics (bodyweight)" },
    { value: "mixed", label: "Mix of both" },
    { value: "home", label: "Home — minimal equipment" }] },
  { key: "diet_preference", title: "Diet preference", type: "choice", options: [
    { value: "omnivore", label: "Omnivore" }, { value: "vegetarian", label: "Vegetarian" },
    { value: "vegan", label: "Vegan" }, { value: "keto", label: "Keto" }] },
  { key: "wake_time", title: "When do you wake up?", type: "time", placeholder: "06:30" },
  { key: "sleep_time", title: "When do you sleep?", type: "time", placeholder: "22:30" },
  { key: "work_schedule", title: "Work schedule?", type: "choice", options: [
    { value: "mon_fri", label: "Mon – Fri" },
    { value: "mon_sat", label: "Mon – Sat" },
    { value: "flexible", label: "Flexible / remote" },
    { value: "shift", label: "Shift work" },
    { value: "none", label: "No fixed job" }] },
  { key: "work_start", title: "Work start time", type: "time", placeholder: "09:00", skipIf: { work_schedule: "none" } },
  { key: "work_end", title: "Work end time", type: "time", placeholder: "17:00", skipIf: { work_schedule: "none" } },
] as const;

export default function Quiz() {
  const { token, refreshUser, refreshSubscription, logout } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const current = STEPS[step];
  const value = answers[current.key];
  const progress = ((step + 1) / STEPS.length) * 100;

  // Guard: if user has no active sub, send them to paywall first
  useEffect(() => {
    (async () => {
      const sub = await refreshSubscription();
      if (sub && !sub.active) router.replace("/paywall");
    })();
  }, []);

  const setVal = (v: any) => setAnswers({ ...answers, [current.key]: v });

  const onLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const next = async () => {
    setErr("");
    if (value === undefined || value === "") return setErr("Please answer to continue");

    // skip subsequent steps that are conditional and shouldn't apply
    let nextStep = step + 1;
    while (nextStep < STEPS.length) {
      const cand: any = STEPS[nextStep];
      if (cand.skipIf) {
        const k = Object.keys(cand.skipIf)[0];
        const v = (cand.skipIf as any)[k];
        const a = k === current.key ? value : answers[k];
        if (a === v) { nextStep++; continue; }
      }
      break;
    }

    if (nextStep < STEPS.length) {
      setStep(nextStep);
      return;
    }
    setBusy(true);
    try {
      // Normalize all time fields before submit
      const normTimes: Record<string, string> = {};
      for (const k of ["wake_time", "sleep_time", "work_start", "work_end"]) {
        if (answers[k]) {
          const v = k === current.key ? value : answers[k];
          const norm = normalizeTime(v);
          if (!norm) { setBusy(false); return setErr(`Time "${v}" is invalid — use 6pm or 18:00`); }
          normTimes[k] = norm;
        }
      }
      const payload = {
        ...answers,
        [current.key]: value,
        ...normTimes,
        age: Number(answers.age),
        height_cm: Number(answers.height_cm),
        weight_kg: Number(answers.weight_kg),
        workout_days_per_week: Number(answers.workout_days_per_week),
      };
      await api(token, "/api/quiz/submit", { method: "POST", body: JSON.stringify(payload) });
      await refreshUser();
      router.replace("/(tabs)");
    } catch (e: any) {
      const msg = e.message || "Submission failed";
      if (msg.toLowerCase().includes("subscription")) {
        // Force user to paywall — refresh sub first in case they paid externally
        await refreshSubscription();
        router.replace("/paywall");
        return;
      }
      setErr(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={s.c}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.stepLabel}>STEP {step + 1} / {STEPS.length}</Text>
            <View style={s.progBg}>
              <View style={[s.progFill, { width: `${progress}%` }]} />
            </View>
          </View>
          <TouchableOpacity testID="quiz-logout" onPress={onLogout} style={s.logoutBtn}>
            <LogOut color={colors.textMuted} size={16} />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Text style={s.title} testID={`quiz-title-${current.key}`}>{current.title}</Text>

          {current.type === "choice" && (
            <View style={s.choices}>
              {current.options!.map((o: Choice) => {
                const selected = value === o.value;
                return (
                  <TouchableOpacity
                    key={o.value}
                    testID={`quiz-choice-${o.value}`}
                    style={[s.choice, selected && s.choiceSelected]}
                    onPress={() => setVal(o.value)}
                  >
                    <Text style={[s.choiceText, selected && s.choiceTextSelected]}>{o.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {(current.type === "number" || current.type === "time") && (
            <TextInput
              testID={`quiz-input-${current.key}`}
              style={s.input}
              value={value ?? ""}
              onChangeText={setVal}
              placeholder={(current as any).placeholder}
              placeholderTextColor={colors.textDim}
              keyboardType={current.type === "number" ? "numeric" : "default"}
            />
          )}
          {current.type === "time" && (
            <Text style={s.hint}>Accepts 6pm · 6:30pm · 18:00</Text>
          )}

          {err ? <Text style={s.err}>{err}</Text> : null}
        </ScrollView>

        <View style={s.footer}>
          {step > 0 && (
            <TouchableOpacity testID="quiz-back" style={s.btnBack} onPress={() => setStep(step - 1)}>
              <Text style={s.btnBackText}>Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity testID="quiz-next" style={s.btn} onPress={next} disabled={busy}>
            {busy ? <ActivityIndicator color="#000" /> :
              <Text style={s.btnText}>{step === STEPS.length - 1 ? "Generate plan" : "Continue"}</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 24, paddingTop: 12, gap: 12 },
  logoutBtn: { padding: 8, borderRadius: 999, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
  stepLabel: { color: colors.primary, fontSize: 11, letterSpacing: 3, fontWeight: "700" },
  progBg: { height: 4, backgroundColor: colors.surface, borderRadius: 2, marginTop: 12 },
  progFill: { height: 4, backgroundColor: colors.primary, borderRadius: 2 },
  scroll: { padding: 24, paddingTop: 32 },
  title: { color: colors.text, fontSize: 30, fontWeight: "800", marginBottom: 28, lineHeight: 36 },
  choices: { gap: 12 },
  choice: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, padding: 18, borderRadius: 16 },
  choiceSelected: { borderColor: colors.primary, backgroundColor: colors.primaryGlow },
  choiceText: { color: colors.text, fontSize: 16, fontWeight: "500" },
  choiceTextSelected: { color: colors.primary, fontWeight: "700" },
  input: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, color: colors.text, padding: 20, borderRadius: 16, fontSize: 22, fontWeight: "600" },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: 8, fontStyle: "italic" },
  err: { color: colors.error, marginTop: 16 },
  footer: { flexDirection: "row", padding: 24, gap: 12 },
  btn: { flex: 1, backgroundColor: colors.primary, padding: 16, borderRadius: 999, alignItems: "center" },
  btnText: { color: "#000", fontWeight: "800", fontSize: 16, letterSpacing: 1 },
  btnBack: { paddingHorizontal: 24, padding: 16, borderRadius: 999, borderColor: colors.border, borderWidth: 1, alignItems: "center" },
  btnBackText: { color: colors.text, fontWeight: "600" },
});
