import { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ImageBackground,
  ActivityIndicator, Alert, RefreshControl, TextInput, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Droplet, Flame, Plus, Sun, Moon, Coffee, Utensils, Dumbbell, RotateCcw } from "lucide-react-native";
import { useAuth, api } from "../../src/auth";
import { colors } from "../../src/theme";

type Today = {
  water_glasses: number; water_target: number;
  calories_consumed: number; calorie_target: number;
  meals: { name: string; calories: number }[];
  reminders: { id: string; label: string; time: string; icon: string }[];
};

const ICONS: Record<string, any> = {
  sun: Sun, moon: Moon, coffee: Coffee, utensils: Utensils,
  dumbbell: Dumbbell, droplet: Droplet,
};

export default function Home() {
  const { token, user } = useAuth();
  const [today, setToday] = useState<Today | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mealModal, setMealModal] = useState(false);
  const [mealName, setMealName] = useState("");
  const [mealCal, setMealCal] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api(token, "/api/tracker/today");
      setToday(data);
    } catch (e: any) {
      console.log("load error", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
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
    Alert.alert("Reset today?", "Clear water + calorie progress.", [
      { text: "Cancel", style: "cancel" },
      { text: "Reset", style: "destructive", onPress: async () => {
        await api(token, "/api/tracker/reset", { method: "POST" });
        load();
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
          <View>
            <Text style={s.hello}>Welcome back</Text>
            <Text style={s.name} testID="home-name">{user?.name}</Text>
          </View>
          <TouchableOpacity testID="home-reset" onPress={reset} style={s.resetBtn}>
            <RotateCcw color={colors.textMuted} size={18} />
          </TouchableOpacity>
        </View>

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

        <Text style={s.sectionTitle}>Today's schedule</Text>
        <View style={s.timeline}>
          {today.reminders.length === 0 ? (
            <Text style={s.empty}>Complete the quiz to get your reminders.</Text>
          ) : today.reminders.map((r, i) => {
            const Icon = ICONS[r.icon] || Sun;
            return (
              <View key={r.id} style={s.timeItem}>
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
                </View>
              </View>
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
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "700", marginTop: 8, marginBottom: 12 },
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
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", padding: 24 },
  modal: { backgroundColor: colors.surfaceElevated, padding: 24, borderRadius: 20, borderWidth: 1, borderColor: colors.border, gap: 12 },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: "700", marginBottom: 4 },
  modalInput: { backgroundColor: "#0A0A0A", padding: 14, borderRadius: 12, color: colors.text, borderColor: colors.border, borderWidth: 1 },
  modalBtn: { padding: 14, borderRadius: 999, alignItems: "center" },
});
