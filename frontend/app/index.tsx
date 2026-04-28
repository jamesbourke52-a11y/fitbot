import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../src/auth";
import { colors } from "../src/theme";

export default function Index() {
  const { user, loading, subscription } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (!subscription?.active) router.replace("/paywall");
    else if (!user.has_completed_quiz) router.replace("/quiz");
    else router.replace("/(tabs)");
  }, [user, loading, subscription]);

  return (
    <View style={s.c}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
});
