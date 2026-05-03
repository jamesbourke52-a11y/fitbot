import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, Check, Zap, Lock } from "lucide-react-native";
import { useAuth, api } from "../src/auth";
import { colors } from "../src/theme";

export default function LevelUp() {
  const { token } = useAuth();
  const router = useRouter();
  const [levels, setLevels] = useState<any[]>([]);
  const [me, setMe] = useState<any>(null);
  const [saving, setSaving] = useState(false);

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
    </SafeAreaView>
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
});
