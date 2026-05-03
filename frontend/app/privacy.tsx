import { ScrollView, Text, StyleSheet, View, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { colors } from "../src/theme";

export default function Privacy() {
  const router = useRouter();
  return (
    <SafeAreaView style={s.c} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}>
          <ChevronLeft color={colors.text} size={22} />
        </TouchableOpacity>
        <Text style={s.title}>Privacy Policy</Text>
      </View>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.updated}>Last updated: 1 May 2026</Text>

        <Text style={s.h2}>1. Who we are</Text>
        <Text style={s.p}>
          FitLux ("we", "us") provides an AI-powered personal fitness mobile app
          and website. This policy explains how we collect, use, and protect
          your data, in line with the EU GDPR and the UK GDPR.
        </Text>

        <Text style={s.h2}>2. What we collect</Text>
        <Text style={s.p}><Text style={s.b}>Account data:</Text> name, email, password (hashed), creation date.</Text>
        <Text style={s.p}><Text style={s.b}>Quiz / fitness profile:</Text> goals, work schedule, training preferences, body metrics you choose to share.</Text>
        <Text style={s.p}><Text style={s.b}>Usage data:</Text> screens viewed, schedule entries, AI coach messages, water/calorie tracking.</Text>
        <Text style={s.p}><Text style={s.b}>Payment data:</Text> processed entirely by Stripe. We never see or store your card number; we only receive a checkout session ID and subscription status.</Text>
        <Text style={s.p}><Text style={s.b}>Device data:</Text> approximate region, app version, OS, error logs.</Text>

        <Text style={s.h2}>3. How we use it</Text>
        <Text style={s.p}>• Generate your AI fitness plan and coaching answers.</Text>
        <Text style={s.p}>• Operate your subscription and remind you of workouts.</Text>
        <Text style={s.p}>• Send transactional emails (account, payment, drip onboarding) — you can opt out of non-essential ones at any time.</Text>
        <Text style={s.p}>• Improve the app and detect abuse.</Text>

        <Text style={s.h2}>4. Third-party services</Text>
        <Text style={s.p}>• <Text style={s.b}>Stripe</Text> — payments. Their privacy policy: stripe.com/privacy.</Text>
        <Text style={s.p}>• <Text style={s.b}>Anthropic Claude</Text> — generates your AI fitness plan and coach responses. Quiz answers and chat messages are sent for inference. Anthropic does not retain inputs or use them for training when accessed via the API.</Text>
        <Text style={s.p}>• <Text style={s.b}>Resend</Text> — sends our emails.</Text>
        <Text style={s.p}>• <Text style={s.b}>Amazon Associates</Text> — when you tap a Shop product, you leave the app and Amazon's privacy policy applies. We earn commission on qualifying purchases.</Text>
        <Text style={s.p}>• <Text style={s.b}>MongoDB Atlas</Text> — stores your account/profile data, hosted in EU region.</Text>

        <Text style={s.h2}>5. Legal basis (GDPR Art. 6)</Text>
        <Text style={s.p}>We rely on (a) contract necessity for account/subscription processing, (b) legitimate interest for product improvement and abuse prevention, and (c) consent for non-essential marketing emails — which you can withdraw any time.</Text>

        <Text style={s.h2}>6. Retention</Text>
        <Text style={s.p}>Account data is kept while your account exists. After deletion we keep minimal billing records for 7 years (UK/EU tax law). Anonymous aggregated analytics may be kept indefinitely.</Text>

        <Text style={s.h2}>7. Your rights</Text>
        <Text style={s.p}>You can access, correct, export, restrict, or delete your data, and object to processing. Email <Text style={s.link}>privacy@fitlux.fitness</Text> with the request — we respond within 30 days.</Text>

        <Text style={s.h2}>8. Children</Text>
        <Text style={s.p}>FitLux is not for users under 16. We do not knowingly collect their data. If you believe a minor has signed up, contact us and we will delete the account.</Text>

        <Text style={s.h2}>9. International transfers</Text>
        <Text style={s.p}>Some providers (Stripe, Anthropic, Resend) process data in the United States under appropriate safeguards (Standard Contractual Clauses).</Text>

        <Text style={s.h2}>10. Security</Text>
        <Text style={s.p}>Passwords are bcrypt-hashed. All traffic uses TLS 1.2+. Subscription tokens are short-lived JWTs stored on-device only.</Text>

        <Text style={s.h2}>11. Changes</Text>
        <Text style={s.p}>We may update this policy; material changes will be announced in-app at least 14 days before they take effect.</Text>

        <Text style={s.h2}>12. Contact</Text>
        <Text style={s.p}>FitLux · privacy@fitlux.fitness</Text>

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
  title: { color: colors.text, fontSize: 22, fontWeight: "900" },
  content: { paddingHorizontal: 20, paddingBottom: 30 },
  updated: { color: colors.textDim, marginBottom: 18, fontSize: 12 },
  h2: { color: colors.primary, fontSize: 14, fontWeight: "800", marginTop: 18, marginBottom: 8, letterSpacing: 0.5 },
  p: { color: colors.text, fontSize: 14, lineHeight: 22, marginBottom: 8 },
  b: { fontWeight: "700" },
  link: { color: colors.primary },
});
