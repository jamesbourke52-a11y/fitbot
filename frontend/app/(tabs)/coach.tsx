import { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Animated, Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Send, Sparkles, Dumbbell, Coffee, Flame, Zap } from "lucide-react-native";
import { useAuth, api } from "../../src/auth";
import { colors } from "../../src/theme";

type Msg = { role: "user" | "assistant"; text: string; kind?: string };

const QUICK_ACTIONS: { icon: any; label: string; prompt: string }[] = [
  { icon: Dumbbell, label: "Walk me through today", prompt: "__walkthrough__" },
  { icon: Coffee, label: "What should I eat today?", prompt: "What should I eat today for my goal?" },
  { icon: Flame, label: "Motivate me", prompt: "Give me a quick motivational push to start training." },
  { icon: Zap, label: "Best supplements?", prompt: "What supplements actually matter for my goal?" },
];

// Animated holographic orb for the coach avatar
function CoachOrb({ active }: { active: boolean }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();
    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 5000, useNativeDriver: true, easing: Easing.linear })
    ).start();
  }, [pulse, spin]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0.1] });
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <View style={orb.wrap}>
      <Animated.View style={[orb.ring, { transform: [{ scale }], opacity }]} />
      <Animated.View style={[orb.ringInner, { transform: [{ rotate }] }]} />
      <View style={orb.core}>
        <Sparkles color={colors.primary} size={22} />
      </View>
      {active && <View style={orb.dot} />}
    </View>
  );
}

export default function Coach() {
  const { token, user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [greeted, setGreeted] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await api(token, "/api/coach/history");
        const msgs: Msg[] = (data.messages || []).map((m: any) => ({
          role: m.role, text: m.text, kind: m.kind,
        }));
        setMessages(msgs);
        if (msgs.length === 0) {
          // First visit — fetch a personalized greeting and display it as if
          // the coach just walked up.
          try {
            const brief = await api(token, "/api/coach/briefing");
            if (brief?.greeting) {
              setMessages([{ role: "assistant", text: brief.greeting, kind: "greeting" }]);
            }
          } catch {}
        }
        setGreeted(true);
      } catch {
        setGreeted(true);
      }
    })();
  }, [token]);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || busy) return;

    // Special: walkthrough uses the dedicated backend endpoint
    if (msg === "__walkthrough__") {
      setMessages((p) => [...p, { role: "user", text: "Walk me through today's workout" }]);
      setBusy(true);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
      try {
        const r = await api(token, "/api/coach/walkthrough", { method: "POST" });
        setMessages((p) => [...p, { role: "assistant", text: r.reply, kind: "walkthrough" }]);
      } catch (e: any) {
        setMessages((p) => [...p, { role: "assistant", text: "I couldn't pull your plan right now. Try again in a moment." }]);
      } finally {
        setBusy(false);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
      }
      return;
    }

    setMessages((p) => [...p, { role: "user", text: msg }]);
    setInput("");
    setBusy(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    try {
      const data = await api(token, "/api/coach/chat", {
        method: "POST", body: JSON.stringify({ message: msg }),
      });
      setMessages((p) => [...p, { role: "assistant", text: data.reply }]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    } catch {
      setMessages((p) => [...p, { role: "assistant", text: "Sorry, I couldn't reply right now." }]);
    } finally {
      setBusy(false);
    }
  };

  const firstName = (user?.name || "").split(" ")[0] || "Athlete";

  return (
    <SafeAreaView style={s.c} edges={["top"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={s.header}>
          <CoachOrb active />
          <View style={{ flex: 1 }}>
            <View style={s.titleRow}>
              <Text style={s.title}>FITLUX COACH</Text>
              <View style={s.online}><View style={s.onlineDot} /><Text style={s.onlineText}>LIVE</Text></View>
            </View>
            <Text style={s.subtitle}>Your AI trainer · right here with you</Text>
          </View>
        </View>

        <ScrollView ref={scrollRef} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          {!greeted && (
            <View style={s.empty}>
              <ActivityIndicator color={colors.primary} />
              <Text style={s.emptyTitle}>Warming up the coach…</Text>
            </View>
          )}

          {messages.map((m, i) => (
            <View
              key={i}
              style={[s.bubbleWrap, m.role === "user" ? { alignItems: "flex-end" } : { alignItems: "flex-start" }]}
            >
              {m.role === "assistant" && m.kind === "greeting" && (
                <View style={s.kickerRow}>
                  <Sparkles color={colors.primary} size={12} />
                  <Text style={s.kickerText}>GREETING · {firstName.toUpperCase()}</Text>
                </View>
              )}
              {m.role === "assistant" && m.kind === "walkthrough" && (
                <View style={s.kickerRow}>
                  <Dumbbell color={colors.primary} size={12} />
                  <Text style={s.kickerText}>TODAY'S WALKTHROUGH</Text>
                </View>
              )}
              <View style={[s.bubble, m.role === "user" ? s.bubbleUser : s.bubbleAi]}>
                <Text style={[s.bubbleText, m.role === "user" && { color: "#000" }]}>{m.text}</Text>
              </View>
            </View>
          ))}

          {busy && (
            <View style={[s.bubbleWrap, { alignItems: "flex-start" }]}>
              <View style={[s.bubble, s.bubbleAi, { flexDirection: "row", gap: 8, alignItems: "center" }]}>
                <ActivityIndicator color={colors.primary} size="small" />
                <Text style={s.typingText}>coach is typing…</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Quick action pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.quickBar}
          contentContainerStyle={s.quickBarInner}
        >
          {QUICK_ACTIONS.map(({ icon: Icon, label, prompt }) => (
            <TouchableOpacity
              key={label}
              style={s.quickPill}
              onPress={() => send(prompt)}
              disabled={busy}
              activeOpacity={0.75}
            >
              <Icon color={colors.primary} size={14} />
              <Text style={s.quickText}>{label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={s.inputBar}>
          <TextInput
            testID="coach-input"
            style={s.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask the coach…"
            placeholderTextColor={colors.textDim}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            testID="coach-send"
            style={[s.sendBtn, (busy || !input.trim()) && { opacity: 0.4 }]}
            onPress={() => send()}
            disabled={busy || !input.trim()}
          >
            <Send color="#000" size={18} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const orb = StyleSheet.create({
  wrap: { width: 56, height: 56, alignItems: "center", justifyContent: "center" },
  ring: {
    position: "absolute", width: 56, height: 56, borderRadius: 28,
    borderWidth: 1.5, borderColor: colors.primary,
  },
  ringInner: {
    position: "absolute", width: 48, height: 48, borderRadius: 24,
    borderWidth: 1, borderColor: colors.primary, borderTopColor: "transparent",
    borderLeftColor: "transparent",
  },
  core: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.primaryGlow, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.primary,
  },
  dot: {
    position: "absolute", top: 2, right: 2, width: 10, height: 10, borderRadius: 5,
    backgroundColor: colors.success, borderWidth: 2, borderColor: colors.bg,
  },
});

const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row", alignItems: "center", padding: 16, gap: 12,
    borderBottomColor: colors.border, borderBottomWidth: 1,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { color: colors.text, fontSize: 16, fontWeight: "900", letterSpacing: 2 },
  online: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(16,185,129,0.12)", paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999, borderWidth: 1, borderColor: "rgba(16,185,129,0.35)",
  },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  onlineText: { color: colors.success, fontSize: 9, fontWeight: "900", letterSpacing: 1.5 },
  subtitle: { color: colors.textMuted, fontSize: 11, marginTop: 3, letterSpacing: 0.5 },
  scroll: { padding: 16, paddingBottom: 16, flexGrow: 1 },
  empty: { padding: 20, alignItems: "center", gap: 12 },
  emptyTitle: { color: colors.textMuted, fontSize: 13, letterSpacing: 1 },
  bubbleWrap: { marginBottom: 12 },
  kickerRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 6, marginLeft: 4 },
  kickerText: { color: colors.primary, fontSize: 9, letterSpacing: 2, fontWeight: "900" },
  bubble: { maxWidth: "88%", padding: 14, borderRadius: 18 },
  bubbleUser: { backgroundColor: colors.primary, borderTopRightRadius: 4 },
  bubbleAi: {
    backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1,
    borderTopLeftRadius: 4,
  },
  bubbleText: { color: colors.text, fontSize: 14, lineHeight: 21 },
  typingText: { color: colors.textDim, fontSize: 12, fontStyle: "italic" },
  quickBar: { maxHeight: 48, borderTopColor: colors.border, borderTopWidth: 1 },
  quickBarInner: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  quickPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1,
  },
  quickText: { color: colors.text, fontSize: 12, fontWeight: "700" },
  inputBar: {
    flexDirection: "row", padding: 12, gap: 10, alignItems: "flex-end",
    borderTopColor: colors.border, borderTopWidth: 1, backgroundColor: colors.bg,
  },
  input: {
    flex: 1, backgroundColor: colors.surface, color: colors.text, padding: 14,
    borderRadius: 22, maxHeight: 100, borderColor: colors.border, borderWidth: 1,
  },
  sendBtn: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },
});
