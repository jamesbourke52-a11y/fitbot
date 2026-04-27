import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LogOut, RefreshCw, MessageCircle } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/auth";
import { colors } from "../../src/theme";

export default function Profile() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const onLogout = () => {
    Alert.alert("Sign out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: async () => {
        await logout();
        router.replace("/login");
      }},
    ]);
  };

  return (
    <SafeAreaView style={s.c} edges={["top"]}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.title}>Profile</Text>

        <View style={s.profileCard}>
          <View style={s.avatar}><Text style={s.avatarText}>{(user?.name || "?")[0].toUpperCase()}</Text></View>
          <View>
            <Text style={s.name} testID="profile-name">{user?.name}</Text>
            <Text style={s.email} testID="profile-email">{user?.email}</Text>
            <View style={s.badge}><Text style={s.badgeText}>FITLUX MEMBER</Text></View>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>ACTIONS</Text>
          <TouchableOpacity testID="profile-retake" style={s.row} onPress={() => router.push("/quiz")}>
            <RefreshCw color={colors.primary} size={18} />
            <Text style={s.rowText}>Retake quiz & regenerate plan</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.row} onPress={() => router.push("/(tabs)/coach")}>
            <MessageCircle color={colors.primary} size={18} />
            <Text style={s.rowText}>Chat with FitLux Coach</Text>
          </TouchableOpacity>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>NOTIFICATIONS</Text>
          <View style={s.infoBox}>
            <Text style={s.infoTitle}>WhatsApp reminders</Text>
            <Text style={s.infoText}>
              WhatsApp integration coming soon. For now, your wake / workout / meal / sleep reminders
              are visible on the Home tab schedule.
            </Text>
          </View>
        </View>

        <TouchableOpacity testID="logout-btn" style={s.logoutBtn} onPress={onLogout}>
          <LogOut color={colors.error} size={18} />
          <Text style={s.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  title: { color: colors.text, fontSize: 30, fontWeight: "900", marginBottom: 20 },
  profileCard: { flexDirection: "row", alignItems: "center", gap: 16, backgroundColor: colors.surface, padding: 20, borderRadius: 20, borderColor: colors.border, borderWidth: 1, marginBottom: 24 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primaryGlow, alignItems: "center", justifyContent: "center", borderColor: colors.primary, borderWidth: 1 },
  avatarText: { color: colors.primary, fontSize: 28, fontWeight: "900" },
  name: { color: colors.text, fontSize: 20, fontWeight: "800" },
  email: { color: colors.textMuted, marginTop: 2 },
  badge: { backgroundColor: colors.primaryGlow, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginTop: 8 },
  badgeText: { color: colors.primary, fontSize: 10, letterSpacing: 1.5, fontWeight: "800" },
  section: { marginBottom: 24 },
  sectionTitle: { color: colors.textDim, fontSize: 11, letterSpacing: 2, fontWeight: "700", marginBottom: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, backgroundColor: colors.surface, borderRadius: 14, borderColor: colors.border, borderWidth: 1, marginBottom: 8 },
  rowText: { color: colors.text, fontSize: 14 },
  infoBox: { backgroundColor: colors.surface, padding: 16, borderRadius: 14, borderColor: colors.border, borderWidth: 1 },
  infoTitle: { color: colors.text, fontWeight: "700", marginBottom: 6 },
  infoText: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, padding: 16, borderColor: colors.error, borderWidth: 1, borderRadius: 999, marginTop: 16 },
  logoutText: { color: colors.error, fontWeight: "700" },
});
