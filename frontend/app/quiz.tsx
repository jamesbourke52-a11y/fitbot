import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth, api } from "../src/auth";
import { colors } from "../src/theme";

type Choice = { value: string; label: string };

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
  const { token, refreshUser } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const current = STEPS[step];
  const value = answers[current.key];
  const progress = ((step + 1) / STEPS.length) * 100;

  const setVal = (v: any) => setAnswers({ ...answers, [current.key]: v });

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
      const payload = {
        ...answers,
        [current.key]: value,
        age: Number(answers.age),
        height_cm: Number(answers.height_cm),
        weight_kg: Number(answers.weight_kg),
        workout_days_per_week: Number(answers.workout_days_per_week),
      };
      await api(token, "/api/quiz/submit", { method: "POST", body: JSON.stringify(payload) });
      await refreshUser();
      router.replace("/(tabs)");
    } catch (e: any) {
      setErr(e.message || "Submission failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={s.c}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={s.header}>
          <Text style={s.stepLabel}>STEP {step + 1} / {STEPS.length}</Text>
          <View style={s.progBg}>
            <View style={[s.progFill, { width: `${progress}%` }]} />
          </View>
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
  header: { paddingHorizontal: 24, paddingTop: 12 },
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
  err: { color: colors.error, marginTop: 16 },
  footer: { flexDirection: "row", padding: 24, gap: 12 },
  btn: { flex: 1, backgroundColor: colors.primary, padding: 16, borderRadius: 999, alignItems: "center" },
  btnText: { color: "#000", fontWeight: "800", fontSize: 16, letterSpacing: 1 },
  btnBack: { paddingHorizontal: 24, padding: 16, borderRadius: 999, borderColor: colors.border, borderWidth: 1, alignItems: "center" },
  btnBackText: { color: colors.text, fontWeight: "600" },
});
