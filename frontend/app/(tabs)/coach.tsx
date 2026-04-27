import { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Send, Sparkles } from "lucide-react-native";
import { useAuth, api } from "../../src/auth";
import { colors } from "../../src/theme";

type Msg = { role: "user" | "assistant"; text: string };

const SUGGESTIONS = [
  "How can I lose belly fat fast?",
  "What should I eat post-workout?",
  "Is shilajit safe to take daily?",
  "How many sets for muscle growth?",
];

export default function Coach() {
  const { token } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await api(token, "/api/coach/history");
        setMessages(data.messages.map((m: any) => ({ role: m.role, text: m.text })));
      } catch {}
    })();
  }, [token]);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || busy) return;
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
    } catch (e: any) {
      setMessages((p) => [...p, { role: "assistant", text: "Sorry, I couldn't reply right now." }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={s.c} edges={["top"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={s.header}>
          <View style={s.avatar}><Sparkles color={colors.primary} size={20} /></View>
          <View>
            <Text style={s.title}>FitLux Coach</Text>
            <Text style={s.subtitle}>AI personal trainer • powered by Claude</Text>
          </View>
        </View>

        <ScrollView ref={scrollRef} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          {messages.length === 0 && (
            <View style={s.empty}>
              <Text style={s.emptyTitle}>Ask anything about training, nutrition, or supplements.</Text>
              <View style={s.sugWrap}>
                {SUGGESTIONS.map((q) => (
                  <TouchableOpacity key={q} style={s.sug} onPress={() => send(q)}>
                    <Text style={s.sugText}>{q}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
          {messages.map((m, i) => (
            <View key={i} style={[s.bubbleWrap, m.role === "user" ? { alignItems: "flex-end" } : { alignItems: "flex-start" }]}>
              <View style={[s.bubble, m.role === "user" ? s.bubbleUser : s.bubbleAi]}>
                <Text style={[s.bubbleText, m.role === "user" && { color: "#000" }]}>{m.text}</Text>
              </View>
            </View>
          ))}
          {busy && (
            <View style={[s.bubbleWrap, { alignItems: "flex-start" }]}>
              <View style={[s.bubble, s.bubbleAi]}>
                <ActivityIndicator color={colors.primary} size="small" />
              </View>
            </View>
          )}
        </ScrollView>

        <View style={s.inputBar}>
          <TextInput
            testID="coach-input"
            style={s.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask the coach..."
            placeholderTextColor={colors.textDim}
            multiline
            maxLength={500}
          />
          <TouchableOpacity testID="coach-send" style={s.sendBtn} onPress={() => send()} disabled={busy}>
            <Send color="#000" size={18} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", padding: 20, gap: 12, borderBottomColor: colors.border, borderBottomWidth: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryGlow, alignItems: "center", justifyContent: "center", borderColor: colors.primary, borderWidth: 1 },
  title: { color: colors.text, fontSize: 18, fontWeight: "800" },
  subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  scroll: { padding: 16, paddingBottom: 16, flexGrow: 1 },
  empty: { padding: 20 },
  emptyTitle: { color: colors.textMuted, fontSize: 15, lineHeight: 22, marginBottom: 16 },
  sugWrap: { gap: 8 },
  sug: { backgroundColor: colors.surface, padding: 14, borderRadius: 14, borderColor: colors.border, borderWidth: 1 },
  sugText: { color: colors.text, fontSize: 14 },
  bubbleWrap: { marginBottom: 10 },
  bubble: { maxWidth: "85%", padding: 14, borderRadius: 18 },
  bubbleUser: { backgroundColor: colors.primary, borderTopRightRadius: 4 },
  bubbleAi: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderTopLeftRadius: 4 },
  bubbleText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  inputBar: { flexDirection: "row", padding: 12, gap: 10, alignItems: "flex-end", borderTopColor: colors.border, borderTopWidth: 1, backgroundColor: colors.bg },
  input: { flex: 1, backgroundColor: colors.surface, color: colors.text, padding: 14, borderRadius: 22, maxHeight: 100, borderColor: colors.border, borderWidth: 1 },
  sendBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
});
