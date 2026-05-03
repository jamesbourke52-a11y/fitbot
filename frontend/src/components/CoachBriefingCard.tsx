import { useEffect, useRef, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Animated, Easing,
} from "react-native";
import { useRouter } from "expo-router";
import { Sparkles, ArrowRight, Mic, Zap, RefreshCw } from "lucide-react-native";
import { api } from "../auth";
import { colors } from "../theme";

type Brief = {
  greeting: string;
  level: { name: string; emoji: string; color?: string };
  style: string;
  time_of_day: string;
  prescription_summary: {
    sets: number;
    key_lifts: any[];
    accessories: any[];
    adjustment_factor: number;
  };
  awaiting_feedback: boolean;
  has_plan: boolean;
};

// Animated holographic ring around the coach avatar — futuristic vibe.
function Orb({ size = 52 }: { size?: number }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1500, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulse, { toValue: 0, duration: 1500, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();
    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 6000, useNativeDriver: true, easing: Easing.linear })
    ).start();
  }, [pulse, spin]);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.2] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0.1] });
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return (
    <View style={[orb.wrap, { width: size, height: size }]}>
      <Animated.View style={[orb.ring, { width: size, height: size, borderRadius: size / 2, transform: [{ scale }], opacity }]} />
      <Animated.View style={[orb.innerRing, { width: size - 8, height: size - 8, borderRadius: (size - 8) / 2, transform: [{ rotate }] }]} />
      <View style={[orb.core, { width: size - 16, height: size - 16, borderRadius: (size - 16) / 2 }]}>
        <Sparkles color={colors.primary} size={size / 3} />
      </View>
    </View>
  );
}

// Plays text like a typewriter for the "coach is speaking" feel
function TypedText({ text, style }: { text: string; style: any }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
    if (!text) return;
    const id = setInterval(() => {
      setI((prev) => {
        if (prev >= text.length) { clearInterval(id); return prev; }
        return prev + Math.max(1, Math.round(text.length / 220));
      });
    }, 15);
    return () => clearInterval(id);
  }, [text]);
  return <Text style={style}>{text.slice(0, i)}</Text>;
}

export default function CoachBriefingCard({ token }: { token: string | null }) {
  const router = useRouter();
  const [brief, setBrief] = useState<Brief | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    try {
      const d = await api(token, "/api/coach/briefing");
      setBrief(d);
    } catch {
      setBrief(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={s.card}>
        <View style={s.headerRow}>
          <Orb />
          <View style={{ flex: 1 }}>
            <Text style={s.kicker}>COACH · WARMING UP</Text>
            <ActivityIndicator color={colors.primary} style={{ marginTop: 8, alignSelf: "flex-start" }} />
          </View>
        </View>
      </View>
    );
  }

  if (!brief || !brief.has_plan) {
    return null; // user hasn't finished the quiz yet — skip
  }

  const lift = brief.prescription_summary.key_lifts[0];
  const liftPreview = lift
    ? (lift.bodyweight
        ? `${lift.name} × ${lift.reps}`
        : `${lift.name} ${lift.weight_display} ${lift.weight_unit} × ${lift.reps}`)
    : null;

  return (
    <View style={s.card}>
      <View style={s.glow} />
      <View style={s.headerRow}>
        <Orb />
        <View style={{ flex: 1 }}>
          <View style={s.kickerRow}>
            <Text style={s.kicker}>FITLUX COACH</Text>
            <View style={s.onlinePill}>
              <View style={s.onlineDot} />
              <Text style={s.onlineText}>LIVE</Text>
            </View>
          </View>
          <Text style={s.levelBadge}>
            {brief.level.emoji} {brief.level.name.toUpperCase()} · {brief.style.toUpperCase()}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => { setLoading(true); load(); }}
          style={s.refreshBtn}
          hitSlop={10}
        >
          <RefreshCw color={colors.textMuted} size={14} />
        </TouchableOpacity>
      </View>

      <TypedText text={brief.greeting} style={s.body} />

      {liftPreview && (
        <View style={s.liftRow}>
          <Zap color={colors.primary} size={14} />
          <Text style={s.liftText}>
            First up: <Text style={{ color: colors.primary, fontWeight: "800" }}>{liftPreview}</Text>
          </Text>
          <Text style={s.setsText}>× {brief.prescription_summary.sets} sets</Text>
        </View>
      )}

      <View style={s.ctaRow}>
        <TouchableOpacity
          style={s.primaryCta}
          onPress={() => router.push("/(tabs)/plan")}
          activeOpacity={0.85}
          testID="briefing-cta-plan"
        >
          <Text style={s.primaryCtaText}>
            {brief.awaiting_feedback ? "Finish today's workout" : "Let's train"}
          </Text>
          <ArrowRight color="#000" size={16} />
        </TouchableOpacity>
        <TouchableOpacity
          style={s.secondaryCta}
          onPress={() => router.push("/(tabs)/coach")}
          activeOpacity={0.85}
          testID="briefing-cta-coach"
        >
          <Mic color={colors.primary} size={14} />
          <Text style={s.secondaryCtaText}>Talk to coach</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const orb = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  ring: {
    position: "absolute", borderWidth: 1.5, borderColor: colors.primary,
  },
  innerRing: {
    position: "absolute", borderWidth: 1, borderColor: colors.primary,
    borderTopColor: "transparent", borderLeftColor: "transparent",
  },
  core: {
    backgroundColor: colors.primaryGlow, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.primary,
  },
});

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.primary,
    marginBottom: 18,
    overflow: "hidden",
  },
  glow: {
    position: "absolute", top: -30, right: -30, width: 160, height: 160,
    borderRadius: 80, backgroundColor: colors.primaryGlow,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  kickerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  kicker: { color: colors.primary, fontSize: 10, letterSpacing: 2.5, fontWeight: "900" },
  onlinePill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999,
    backgroundColor: "rgba(16,185,129,0.12)", borderWidth: 1, borderColor: "rgba(16,185,129,0.35)",
  },
  onlineDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.success },
  onlineText: { color: colors.success, fontSize: 8, fontWeight: "900", letterSpacing: 1.2 },
  levelBadge: { color: colors.textMuted, fontSize: 10, letterSpacing: 1.5, fontWeight: "800", marginTop: 4 },
  refreshBtn: { padding: 6 },
  body: { color: colors.text, fontSize: 14, lineHeight: 21, marginBottom: 12 },
  liftRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12,
    backgroundColor: "rgba(212,175,55,0.07)", borderWidth: 1, borderColor: colors.border,
    marginBottom: 14,
  },
  liftText: { color: colors.text, fontSize: 13, flex: 1 },
  setsText: { color: colors.textMuted, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  ctaRow: { flexDirection: "row", gap: 10 },
  primaryCta: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: colors.primary, paddingVertical: 13, borderRadius: 999,
  },
  primaryCtaText: { color: "#000", fontWeight: "900", fontSize: 14 },
  secondaryCta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingHorizontal: 16, paddingVertical: 13, borderRadius: 999,
    borderWidth: 1, borderColor: colors.primary, backgroundColor: "transparent",
  },
  secondaryCtaText: { color: colors.primary, fontWeight: "800", fontSize: 13 },
});
