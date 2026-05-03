import { ScrollView, Text, StyleSheet, View, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { colors } from "../src/theme";

export default function Terms() {
  const router = useRouter();
  return (
    <SafeAreaView style={s.c} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}>
          <ChevronLeft color={colors.text} size={22} />
        </TouchableOpacity>
        <Text style={s.title}>Terms of Service</Text>
      </View>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.updated}>Last updated: 1 May 2026</Text>

        <Text style={s.h2}>1. Acceptance</Text>
        <Text style={s.p}>By creating an account or using FitLux you accept these terms. If you don't, please don't use the app.</Text>

        <Text style={s.h2}>2. The service</Text>
        <Text style={s.p}>FitLux provides AI-generated fitness and nutrition guidance, a workout library, schedule reminders, an AI coach chat, and an Amazon-affiliate supplement shop. The AI coach is informational; it is not medical advice.</Text>

        <Text style={s.h2}>3. Subscriptions & billing</Text>
        <Text style={s.p}>FitLux Premium is a paid subscription billed via Stripe. Plans:</Text>
        <Text style={s.p}>• Monthly — $6.99 / 30 days</Text>
        <Text style={s.p}>• Yearly — $67.10 / 365 days</Text>
        <Text style={s.p}>Prices may include applicable VAT. Access starts immediately and is granted for the period purchased. We do not auto-renew at this stage; renewals require an explicit re-purchase. No refunds for partial periods, except where required by EU/UK consumer law (14-day cooling-off applies only if you have not yet used the service).</Text>

        <Text style={s.h2}>4. Promo codes</Text>
        <Text style={s.p}>Promotional discount codes apply at checkout, are non-transferable, and have no cash value. We may withdraw or change codes at any time.</Text>

        <Text style={s.h2}>5. Health disclaimer</Text>
        <Text style={s.p}>FitLux is a software product, not a medical service. Consult a qualified healthcare professional before starting any new fitness or nutrition programme, especially if you have an existing condition, are pregnant, or are under 18. By using the app you confirm you are physically able to undertake exercise.</Text>

        <Text style={s.h2}>6. Amazon affiliate links</Text>
        <Text style={s.p}>FitLux is a participant in the Amazon Services LLC Associates Program. We earn commissions on qualifying purchases made through links in the Shop section. Tapping a "View on Amazon" button takes you to Amazon, where Amazon's terms and prices apply.</Text>

        <Text style={s.h2}>7. Acceptable use</Text>
        <Text style={s.p}>You agree not to share your account, attempt to bypass the paywall, scrape the API, abuse the AI coach, or upload illegal content.</Text>

        <Text style={s.h2}>8. Account suspension</Text>
        <Text style={s.p}>We may suspend or close accounts that violate these terms, with refunds at our discretion for any unused subscription window.</Text>

        <Text style={s.h2}>9. Intellectual property</Text>
        <Text style={s.p}>FitLux's name, logo, app design and AI plan templates are our property. Content you submit (e.g. quiz answers, schedule entries) remains yours; you grant us a licence to use it solely to operate the service.</Text>

        <Text style={s.h2}>10. Liability</Text>
        <Text style={s.p}>To the maximum extent permitted by law, FitLux is not liable for indirect or consequential damages, including injury arising from following AI-generated training advice. Total liability is capped at the amount you paid in the previous 12 months.</Text>

        <Text style={s.h2}>11. Governing law</Text>
        <Text style={s.p}>These terms are governed by the laws of England & Wales. Disputes are subject to the exclusive jurisdiction of its courts, except where mandatory consumer law gives you the right to bring action in your local jurisdiction.</Text>

        <Text style={s.h2}>12. Changes</Text>
        <Text style={s.p}>We may update these terms; we will notify you in-app at least 14 days before material changes take effect.</Text>

        <Text style={s.h2}>13. Contact</Text>
        <Text style={s.p}>FitLux · support@fitlux.fitness</Text>

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
});
