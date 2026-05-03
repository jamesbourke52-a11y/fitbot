import { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ImageBackground,
  ActivityIndicator, Alert, RefreshControl, TextInput, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Droplet, Flame, Plus, Sun, Moon, Coffee, Utensils, Dumbbell, RotateCcw,
  Bell, Pencil, Trash2, X,
} from "lucide-react-native";
import { useAuth, api } from "../../src/auth";
import { colors } from "../../src/theme";
import { useRouter } from "expo-router";
import CoachBriefingCard from "../../src/components/CoachBriefingCard";

type Reminder = { id: string; label: string; time: string; icon: string };
type Today = {
  water_glasses: number; water_target: number;
  calories_consumed: number; calorie_target: number;
  meals: { name: string; calories: number }[];
  reminders: Reminder[];
};

const ICONS: Record<string, any> = {
  sun: Sun, moon: Moon, coffee: Coffee, utensils: Utensils,
  dumbbell: Dumbbell, droplet: Droplet, bell: Bell,
};
const ICON_OPTIONS: { key: string; label: string }[] = [
  { key: "bell", label: "Reminder" },
  { key: "sun", label: "Morning" },
  { key: "moon", label: "Night" },
  { key: "coffee", label: "Meal" },
  { key: "utensils", label: "Food" },
  { key: "dumbbell", label: "Workout" },
  { key: "droplet", label: "Water" },
];

const validTime = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

export default function Home() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [today, setToday] = useState<Today | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mealModal, setMealModal] = useState(false);
  const [mealName, setMealName] = useState("");
  const [mealCal, setMealCal] = useState("");
  const [reminderModal, setReminderModal] = useState(false);
  const [editing, setEditing] = useState<Reminder | null>(null);
  const [rLabel, setRLabel] = useState("");
  const [rTime, setRTime] = useState("");
  const [rIcon, setRIcon] = useState("bell");

  const load = useCallback(async () => {
    try {
      const data = await api(token, "/api/tracker/today");
      setToday(data);
    } catch (e: any) {
      console.log("load error", e.message);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const addWater = async () => {
    try {
      await api(token, "/api/tracker/water", { method: "POST", body: JSON.stringify({ glasses: 1 }) });
      load();
    } catch (e: any) { Alert.alert("Error", e.message); }
  };

  const addMeal = async () => {
    if (!mealName || !mealCal) return;
    try {
      await api(token, "/api/tracker/calories", {
        method: "POST",
        body: JSON.stringify({ meal_name: mealName, calories: parseInt(mealCal) }),
      });
      setMealModal(false); setMealName(""); setMealCal("");
      load();
    } catch (e: any) { Alert.alert("Error", e.message); }
  };

  const reset = async () => {
    Alert.alert("Reset today's tracker?", "Clear water + calorie progress (your reminders are kept).", [
      { text: "Cancel", style: "cancel" },
      { text: "Reset", style: "destructive", onPress: async () => {
        await api(token, "/api/tracker/reset", { method: "POST" });
        load();
      }},
    ]);
  };

  // ----- Reminder CRUD -----
  const openAdd = () => {
    setEditing(null);
    setRLabel(""); setRTime(""); setRIcon("bell");
    setReminderModal(true);
  };

  const openEdit = (r: Reminder) => {
    setEditing(r);
    setRLabel(r.label); setRTime(r.time); setRIcon(r.icon || "bell");
    setReminderModal(true);
  };

  const saveReminder = async () => {
    if (!rLabel.trim()) return Alert.alert("Missing", "Please enter a label");
    if (!validTime(rTime)) return Alert.alert("Invalid time", "Use HH:MM (24h), e.g. 07:30");
    try {
      if (editing) {
        await api(token, `/api/reminders/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({ label: rLabel.trim(), time: rTime, icon: rIcon }),
        });
      } else {
        await api(token, "/api/reminders/add", {
          method: "POST",
          body: JSON.stringify({ label: rLabel.trim(), time: rTime, icon: rIcon }),
        });
      }
      setReminderModal(false);
      load();
    } catch (e: any) { Alert.alert("Error", e.message); }
  };

  const deleteReminder = (r: Reminder) => {
    Alert.alert("Delete reminder?", `Remove "${r.label}" from your schedule.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          await api(token, `/api/reminders/${r.id}`, { method: "DELETE" });
          setReminderModal(false);
          load();
        } catch (e: any) { Alert.alert("Error", e.message); }
      }},
    ]);
  };

  const resetSchedule = () => {
    Alert.alert("Reset schedule?", "Restore the default schedule generated from your quiz.", [
      { text: "Cancel", style: "cancel" },
      { text: "Reset", onPress: async () => {
        try {
          await api(token, "/api/reminders/reset", { method: "POST" });
          load();
        } catch (e: any) { Alert.alert("Error", e.message); }
      }},
    ]);
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.primary} /></View>;
  if (!today) return null;

  const waterPct = Math.min(100, (today.water_glasses / today.water_target) * 100);
  const calPct = Math.min(100, (today.calories_consumed / today.calorie_target) * 100);

  return (
    <SafeAreaView style={s.c} edges={["top"]}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
      >
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.hello}>Welcome back</Text>
            <Text style={s.name} testID="home-name">{user?.name}</Text>
          </View>
          <TouchableOpacity testID="home-reset" onPress={reset} style={s.resetBtn}>
            <RotateCcw color={colors.textMuted} size={18} />
          </TouchableOpacity>
          <TouchableOpacity testID="home-profile" onPress={() => router.push("/profile")} style={s.avatar}>
            <Text style={s.avatarText}>{(user?.name || "?")[0].toUpperCase()}</Text>
          </TouchableOpacity>
        </View>

        <CoachBriefingCard token={token} />

        <ImageBackground
          source={{ uri: "https://images.pexels.com/photos/29392549/pexels-photo-29392549.jpeg" }}
          style={s.workoutCard}
          imageStyle={{ borderRadius: 24, opacity: 0.55 }}
        >
          <View style={s.workoutOverlay}>
            <Text style={s.workoutKicker}>TODAY'S SESSION</Text>
            <Text style={s.workoutTitle}>Power & Strength</Text>
            <Text style={s.workoutSub}>Open the Plan tab for the full breakdown</Text>
          </View>
        </ImageBackground>

        <View style={s.row}>
          <View style={[s.statCard, { flex: 1 }]}>
            <View style={s.statHead}>
              <Droplet color={colors.water} size={18} />
              <Text style={s.statLabel}>WATER</Text>
            </View>
            <Text style={s.statValue} testID="home-water-value">
              {today.water_glasses}<Text style={s.statTarget}>/{today.water_target}</Text>
            </Text>
            <View style={s.barBg}><View style={[s.barFill, { width: `${waterPct}%`, backgroundColor: colors.water }]} /></View>
            <TouchableOpacity testID="home-add-water" style={s.smallBtn} onPress={addWater}>
              <Plus color={colors.water} size={14} />
              <Text style={[s.smallBtnText, { color: colors.water }]}>Glass</Text>
            </TouchableOpacity>
          </View>

          <View style={[s.statCard, { flex: 1 }]}>
            <View style={s.statHead}>
              <Flame color={colors.primary} size={18} />
              <Text style={s.statLabel}>CALORIES</Text>
            </View>
            <Text style={s.statValue} testID="home-cal-value">
              {today.calories_consumed}<Text style={s.statTarget}>/{today.calorie_target}</Text>
            </Text>
            <View style={s.barBg}><View style={[s.barFill, { width: `${calPct}%`, backgroundColor: colors.primary }]} /></View>
            <TouchableOpacity testID="home-add-meal" style={s.smallBtn} onPress={() => setMealModal(true)}>
              <Plus color={colors.primary} size={14} />
              <Text style={[s.smallBtnText, { color: colors.primary }]}>Meal</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.scheduleHead}>
          <Text style={s.sectionTitle}>Today's schedule</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity testID="schedule-reset" onPress={resetSchedule} style={s.iconBtn}>
              <RotateCcw color={colors.textMuted} size={16} />
            </TouchableOpacity>
            <TouchableOpacity testID="schedule-add" onPress={openAdd} style={s.addBtn}>
              <Plus color="#000" size={18} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.timeline}>
          {today.reminders.length === 0 ? (
            <Text style={s.empty}>No reminders yet — tap + to add one.</Text>
          ) : today.reminders.map((r, i) => {
            const Icon = ICONS[r.icon] || Bell;
            return (
              <TouchableOpacity
                key={r.id}
                testID={`reminder-${r.id}`}
                style={s.timeItem}
                onPress={() => openEdit(r)}
                activeOpacity={0.7}
              >
                <View style={s.timeDotWrap}>
                  <View style={s.timeDot} />
                  {i < today.reminders.length - 1 && <View style={s.timeLine} />}
                </View>
                <View style={s.timeCard}>
                  <View style={s.timeIconWrap}><Icon color={colors.primary} size={18} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.timeLabel}>{r.label}</Text>
                    <Text style={s.timeTime}>{r.time}</Text>
                  </View>
                  <Pencil color={colors.textDim} size={14} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {today.meals.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Logged meals</Text>
            {today.meals.map((m, i) => (
              <View key={i} style={s.mealRow}>
                <Text style={s.mealName}>{m.name}</Text>
                <Text style={s.mealCal}>{m.calories} kcal</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* Meal modal */}
      <Modal visible={mealModal} transparent animationType="fade" onRequestClose={() => setMealModal(false)}>
        <View style={s.modalBg}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Log a meal</Text>
            <TextInput testID="modal-meal-name" style={s.modalInput} placeholder="Meal name" placeholderTextColor={colors.textDim}
              value={mealName} onChangeText={setMealName} />
            <TextInput testID="modal-meal-cal" style={s.modalInput} placeholder="Calories" placeholderTextColor={colors.textDim}
              value={mealCal} onChangeText={setMealCal} keyboardType="numeric" />
            <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
              <TouchableOpacity style={[s.modalBtn, { flex: 1, backgroundColor: colors.surface }]} onPress={() => setMealModal(false)}>
                <Text style={{ color: colors.text }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="modal-meal-save" style={[s.modalBtn, { flex: 1, backgroundColor: colors.primary }]} onPress={addMeal}>
                <Text style={{ color: "#000", fontWeight: "700" }}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reminder add/edit modal */}
      <Modal visible={reminderModal} transparent animationType="slide" onRequestClose={() => setReminderModal(false)}>
        <View style={s.modalBg}>
          <View style={s.modal}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>{editing ? "Edit reminder" : "Add reminder"}</Text>
              <TouchableOpacity onPress={() => setReminderModal(false)}>
                <X color={colors.textMuted} size={20} />
              </TouchableOpacity>
            </View>

            <Text style={s.lbl}>LABEL</Text>
            <TextInput
              testID="reminder-label"
              style={s.modalInput}
              placeholder="e.g. Stretch session"
              placeholderTextColor={colors.textDim}
              value={rLabel}
              onChangeText={setRLabel}
            />

            <Text style={s.lbl}>TIME (24h, HH:MM)</Text>
            <TextInput
              testID="reminder-time"
              style={s.modalInput}
              placeholder="07:30"
              placeholderTextColor={colors.textDim}
              value={rTime}
              onChangeText={setRTime}
              maxLength={5}
            />

            <Text style={s.lbl}>ICON</Text>
            <View style={s.iconGrid}>
              {ICON_OPTIONS.map((opt) => {
                const Icon = ICONS[opt.key];
                const sel = rIcon === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    testID={`icon-${opt.key}`}
                    style={[s.iconChip, sel && s.iconChipSel]}
                    onPress={() => setRIcon(opt.key)}
                  >
                    <Icon color={sel ? "#000" : colors.primary} size={16} />
                    <Text style={[s.iconChipText, sel && { color: "#000", fontWeight: "700" }]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              {editing && (
                <TouchableOpacity
                  testID="reminder-delete"
                  style={[s.modalBtn, { backgroundColor: "#3a0e0e", borderColor: colors.error, borderWidth: 1 }]}
                  onPress={() => deleteReminder(editing)}
                >
                  <Trash2 color={colors.error} size={18} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                testID="reminder-save"
                style={[s.modalBtn, { flex: 1, backgroundColor: colors.primary }]}
                onPress={saveReminder}
              >
                <Text style={{ color: "#000", fontWeight: "800" }}>{editing ? "Save changes" : "Add to schedule"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  hello: { color: colors.textMuted, fontSize: 13, letterSpacing: 1 },
  name: { color: colors.text, fontSize: 26, fontWeight: "800", marginTop: 2 },
  resetBtn: { padding: 12, borderRadius: 12, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
  avatar: { marginLeft: 10, width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primaryGlow, borderColor: colors.primary, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.primary, fontSize: 16, fontWeight: "900" },
  workoutCard: { height: 160, borderRadius: 24, overflow: "hidden", backgroundColor: colors.surface, marginBottom: 20 },
  workoutOverlay: { flex: 1, padding: 20, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 24 },
  workoutKicker: { color: colors.primary, fontSize: 11, letterSpacing: 3, fontWeight: "800" },
  workoutTitle: { color: colors.text, fontSize: 28, fontWeight: "900", marginTop: 4 },
  workoutSub: { color: colors.textMuted, marginTop: 4, fontSize: 12 },
  row: { flexDirection: "row", gap: 12, marginBottom: 24 },
  statCard: { backgroundColor: colors.surface, padding: 16, borderRadius: 20, borderColor: colors.border, borderWidth: 1 },
  statHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  statLabel: { color: colors.textMuted, fontSize: 11, letterSpacing: 2, fontWeight: "700" },
  statValue: { color: colors.text, fontSize: 28, fontWeight: "800" },
  statTarget: { color: colors.textDim, fontSize: 14, fontWeight: "500" },
  barBg: { height: 6, backgroundColor: "#0A0A0A", borderRadius: 3, marginTop: 10, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 3 },
  smallBtn: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: colors.border, marginTop: 12 },
  smallBtnText: { fontSize: 12, fontWeight: "700" },
  scheduleHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8, marginBottom: 12 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "700" },
  iconBtn: { padding: 10, borderRadius: 999, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  empty: { color: colors.textMuted, padding: 16 },
  timeline: { paddingLeft: 4 },
  timeItem: { flexDirection: "row", marginBottom: 8 },
  timeDotWrap: { alignItems: "center", width: 22 },
  timeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, marginTop: 18 },
  timeLine: { flex: 1, width: 2, backgroundColor: colors.border, marginTop: 4 },
  timeCard: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface, padding: 14, borderRadius: 14, borderColor: colors.border, borderWidth: 1, marginLeft: 8 },
  timeIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primaryGlow, alignItems: "center", justifyContent: "center" },
  timeLabel: { color: colors.text, fontWeight: "600", fontSize: 14 },
  timeTime: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  mealRow: { flexDirection: "row", justifyContent: "space-between", padding: 14, backgroundColor: colors.surface, borderRadius: 12, marginBottom: 8, borderColor: colors.border, borderWidth: 1 },
  mealName: { color: colors.text, fontSize: 14 },
  mealCal: { color: colors.primary, fontWeight: "700" },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", padding: 20 },
  modal: { backgroundColor: colors.surfaceElevated, padding: 22, borderRadius: 22, borderWidth: 1, borderColor: colors.border },
  modalHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: "800" },
  lbl: { color: colors.textDim, fontSize: 11, letterSpacing: 2, fontWeight: "700", marginTop: 14, marginBottom: 6 },
  modalInput: { backgroundColor: "#0A0A0A", padding: 14, borderRadius: 12, color: colors.text, borderColor: colors.border, borderWidth: 1, fontSize: 15 },
  modalBtn: { padding: 14, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  iconGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  iconChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  iconChipSel: { backgroundColor: colors.primary, borderColor: colors.primary },
  iconChipText: { color: colors.text, fontSize: 12 },
});
