import { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Modal, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ChevronLeft, Plus, Users, DollarSign, Tag, TrendingUp,
  Power, Trash2, CircleCheckBig, BadgePercent, UserCheck,
} from "lucide-react-native";
import { useAuth, api } from "../src/auth";
import { colors } from "../src/theme";

type Metrics = {
  total_users: number;
  active_subscriptions: number;
  total_revenue_usd: number;
  paid_transactions: number;
  promo_codes_total: number;
  promo_codes_active: number;
  influencer_signups: number;
  influencer_pending_eur: number;
  influencer_paid_eur: number;
};

type PromoCode = {
  code: string;
  influencer_id: string;
  influencer_name: string;
  discount_percent: number;
  commission_eur: number;
  active: boolean;
  created_at: string;
};

type Influencer = {
  id: string;
  name: string;
  email: string;
  pending_eur: number;
  paid_eur: number;
  total_signups: number;
  last_payout_at?: string;
  created_at: string;
};

type Earning = {
  influencer_id: string;
  user_id: string;
  promo_code: string;
  amount_eur: number;
  session_id: string;
  status: string;
  earned_at: string;
  paid_at?: string;
};

type Tab = "overview" | "codes" | "influencers" | "earnings";

export default function AdminScreen() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [createOpen, setCreateOpen] = useState(false);

  // Gate: only admins can enter.
  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace("/login");
    else if (user.role !== "admin") router.replace("/(tabs)");
  }, [user, authLoading]);

  const loadAll = useCallback(async () => {
    if (!token) return;
    try {
      const [m, c, i, e] = await Promise.all([
        api(token, "/api/admin/metrics"),
        api(token, "/api/admin/promo-codes"),
        api(token, "/api/admin/influencers"),
        api(token, "/api/admin/influencer-earnings"),
      ]);
      setMetrics(m);
      setCodes(c.codes || []);
      setInfluencers(i.influencers || []);
      setEarnings(e.earnings || []);
    } catch (err: any) {
      Alert.alert("Load failed", err?.message || "Could not load admin data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    if (!authLoading && token && user?.role === "admin") loadAll();
  }, [authLoading, token, user, loadAll]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAll();
  };

  const togglePromo = async (code: PromoCode) => {
    try {
      await api(token, `/api/admin/promo-codes/${code.code}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !code.active }),
      });
      await loadAll();
    } catch (e: any) {
      Alert.alert("Update failed", e?.message || "Try again");
    }
  };

  const deletePromo = (code: PromoCode) => {
    Alert.alert(
      "Delete promo code?",
      `${code.code} will be permanently removed.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api(token, `/api/admin/promo-codes/${code.code}`, { method: "DELETE" });
              await loadAll();
            } catch (e: any) {
              Alert.alert("Delete failed", e?.message || "Try again");
            }
          },
        },
      ],
    );
  };

  const markPaid = (inf: Influencer) => {
    if ((inf.pending_eur || 0) <= 0) {
      Alert.alert("Nothing to pay", `${inf.name} has no pending balance.`);
      return;
    }
    Alert.alert(
      "Confirm payout",
      `Mark €${inf.pending_eur.toFixed(2)} as paid to ${inf.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark paid",
          onPress: async () => {
            try {
              await api(token, `/api/admin/influencers/${inf.id}/payout`, { method: "POST" });
              await loadAll();
            } catch (e: any) {
              Alert.alert("Payout failed", e?.message || "Try again");
            }
          },
        },
      ],
    );
  };

  if (loading || authLoading) {
    return (
      <SafeAreaView style={s.c} edges={["top"]}>
        <View style={s.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.c} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity style={s.back} onPress={() => router.replace("/(tabs)")}>
          <ChevronLeft color={colors.text} size={22} />
        </TouchableOpacity>
        <Text style={s.title}>Admin</Text>
        <View style={s.adminBadge}><Text style={s.adminBadgeText}>ADMIN</Text></View>
      </View>

      <View style={s.tabs}>
        {(["overview", "codes", "influencers", "earnings"] as Tab[]).map((t) => (
          <TouchableOpacity key={t} onPress={() => setTab(t)}
            style={[s.tabBtn, tab === t && s.tabBtnActive]}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>{tabLabel(t)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl tintColor={colors.primary} refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {tab === "overview" && metrics && <OverviewTab m={metrics} />}
        {tab === "codes" && (
          <CodesTab
            codes={codes}
            onToggle={togglePromo}
            onDelete={deletePromo}
            onCreate={() => setCreateOpen(true)}
          />
        )}
        {tab === "influencers" && (
          <InfluencersTab influencers={influencers} onMarkPaid={markPaid} />
        )}
        {tab === "earnings" && <EarningsTab earnings={earnings} />}
      </ScrollView>

      <CreatePromoModal
        visible={createOpen}
        token={token}
        onClose={() => setCreateOpen(false)}
        onCreated={() => { setCreateOpen(false); loadAll(); }}
      />
    </SafeAreaView>
  );
}

function tabLabel(t: Tab) {
  return t === "overview" ? "Overview"
    : t === "codes" ? "Promo Codes"
    : t === "influencers" ? "Influencers"
    : "Earnings";
}

/* ---------- Overview ---------- */
function OverviewTab({ m }: { m: Metrics }) {
  return (
    <View>
      <View style={s.gridRow}>
        <StatCard icon={<Users color={colors.primary} size={20} />} label="Total users" value={String(m.total_users)} />
        <StatCard icon={<UserCheck color={colors.success} size={20} />} label="Active subs" value={String(m.active_subscriptions)} />
      </View>
      <View style={s.gridRow}>
        <StatCard icon={<DollarSign color={colors.primary} size={20} />} label="Revenue (USD)" value={`$${m.total_revenue_usd.toFixed(2)}`} />
        <StatCard icon={<TrendingUp color={colors.accent} size={20} />} label="Paid tx" value={String(m.paid_transactions)} />
      </View>
      <View style={s.gridRow}>
        <StatCard icon={<Tag color={colors.primary} size={20} />} label="Promo codes" value={`${m.promo_codes_active} / ${m.promo_codes_total}`} hint="active / total" />
        <StatCard icon={<BadgePercent color={colors.accent} size={20} />} label="Promo signups" value={String(m.influencer_signups)} />
      </View>
      <View style={s.gridRow}>
        <StatCard icon={<DollarSign color={colors.accent} size={20} />} label="Pending payouts" value={`€${m.influencer_pending_eur.toFixed(2)}`} accent />
        <StatCard icon={<CircleCheckBig color={colors.success} size={20} />} label="Paid out" value={`€${m.influencer_paid_eur.toFixed(2)}`} />
      </View>
    </View>
  );
}

function StatCard({ icon, label, value, hint, accent }: {
  icon: any; label: string; value: string; hint?: string; accent?: boolean;
}) {
  return (
    <View style={[s.statCard, accent && s.statCardAccent]}>
      <View style={s.statHead}>{icon}<Text style={s.statLabel}>{label}</Text></View>
      <Text style={s.statValue}>{value}</Text>
      {hint && <Text style={s.statHint}>{hint}</Text>}
    </View>
  );
}

/* ---------- Promo Codes ---------- */
function CodesTab({ codes, onToggle, onDelete, onCreate }: {
  codes: PromoCode[];
  onToggle: (c: PromoCode) => void;
  onDelete: (c: PromoCode) => void;
  onCreate: () => void;
}) {
  return (
    <View>
      <TouchableOpacity style={s.primaryBtn} onPress={onCreate}>
        <Plus color="#0A0A0A" size={18} />
        <Text style={s.primaryBtnText}>New promo code</Text>
      </TouchableOpacity>

      {codes.length === 0 && (
        <View style={s.empty}><Text style={s.emptyText}>No promo codes yet. Create one to get started.</Text></View>
      )}

      {codes.map((c) => (
        <View key={c.code} style={s.card}>
          <View style={s.cardHead}>
            <View style={{ flex: 1 }}>
              <Text style={s.codeLabel}>{c.code}</Text>
              <Text style={s.influencer}>{c.influencer_name}</Text>
            </View>
            <View style={[s.statusPill, c.active ? s.statusOn : s.statusOff]}>
              <Text style={[s.statusText, c.active ? s.statusOnText : s.statusOffText]}>
                {c.active ? "ACTIVE" : "PAUSED"}
              </Text>
            </View>
          </View>
          <View style={s.rowMeta}>
            <Text style={s.meta}>{c.discount_percent}% off</Text>
            <Text style={s.metaDot}>·</Text>
            <Text style={s.meta}>€{c.commission_eur.toFixed(2)} / signup</Text>
          </View>
          <View style={s.actions}>
            <TouchableOpacity style={s.iconBtn} onPress={() => onToggle(c)}>
              <Power color={c.active ? colors.accent : colors.success} size={16} />
              <Text style={s.iconBtnText}>{c.active ? "Pause" : "Activate"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.iconBtn} onPress={() => onDelete(c)}>
              <Trash2 color={colors.error} size={16} />
              <Text style={[s.iconBtnText, { color: colors.error }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
}

/* ---------- Influencers ---------- */
function InfluencersTab({ influencers, onMarkPaid }: {
  influencers: Influencer[]; onMarkPaid: (i: Influencer) => void;
}) {
  if (influencers.length === 0) {
    return <View style={s.empty}><Text style={s.emptyText}>No influencers yet. Add a promo code to create one.</Text></View>;
  }
  return (
    <View>
      {influencers.map((inf) => {
        const pending = inf.pending_eur || 0;
        return (
          <View key={inf.id} style={s.card}>
            <View style={s.cardHead}>
              <View style={{ flex: 1 }}>
                <Text style={s.codeLabel}>{inf.name}</Text>
                <Text style={s.influencer}>{inf.email}</Text>
              </View>
              <View style={[s.statusPill, pending > 0 ? s.statusOwed : s.statusOff]}>
                <Text style={[s.statusText, pending > 0 ? s.statusOwedText : s.statusOffText]}>
                  {pending > 0 ? "OWED" : "SETTLED"}
                </Text>
              </View>
            </View>
            <View style={s.statsRow}>
              <View style={s.miniStat}>
                <Text style={s.miniLabel}>Signups</Text>
                <Text style={s.miniValue}>{inf.total_signups}</Text>
              </View>
              <View style={s.miniStat}>
                <Text style={s.miniLabel}>Pending</Text>
                <Text style={[s.miniValue, pending > 0 && { color: colors.accent }]}>€{pending.toFixed(2)}</Text>
              </View>
              <View style={s.miniStat}>
                <Text style={s.miniLabel}>Paid out</Text>
                <Text style={s.miniValue}>€{(inf.paid_eur || 0).toFixed(2)}</Text>
              </View>
            </View>
            {inf.last_payout_at && (
              <Text style={s.lastPayout}>Last payout: {new Date(inf.last_payout_at).toLocaleDateString()}</Text>
            )}
            <TouchableOpacity
              style={[s.payoutBtn, pending <= 0 && s.payoutBtnDisabled]}
              onPress={() => onMarkPaid(inf)}
              disabled={pending <= 0}
            >
              <CircleCheckBig color={pending > 0 ? "#0A0A0A" : colors.textDim} size={16} />
              <Text style={[s.payoutBtnText, pending <= 0 && { color: colors.textDim }]}>
                {pending > 0 ? `Mark €${pending.toFixed(2)} as paid` : "All settled"}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

/* ---------- Earnings ---------- */
function EarningsTab({ earnings }: { earnings: Earning[] }) {
  if (earnings.length === 0) {
    return <View style={s.empty}><Text style={s.emptyText}>No earnings yet. They appear after a paid checkout uses a promo code.</Text></View>;
  }
  return (
    <View>
      {earnings.map((e) => (
        <View key={e.session_id} style={s.earningRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.earningCode}>{e.promo_code}</Text>
            <Text style={s.earningDate}>{new Date(e.earned_at).toLocaleString()}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.earningAmount}>€{e.amount_eur.toFixed(2)}</Text>
            <Text style={[s.earningStatus, e.status === "paid" ? { color: colors.success } : { color: colors.accent }]}>
              {e.status.toUpperCase()}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/* ---------- Create Promo Modal ---------- */
function CreatePromoModal({ visible, token, onClose, onCreated }: {
  visible: boolean; token: string | null; onClose: () => void; onCreated: () => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [discount, setDiscount] = useState("10");
  const [commission, setCommission] = useState("1.00");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setCode(""); setName(""); setEmail(""); setDiscount("10"); setCommission("1.00");
  };

  const submit = async () => {
    if (!code.trim() || !name.trim() || !email.trim()) {
      Alert.alert("Missing fields", "Code, name and email are required.");
      return;
    }
    setSaving(true);
    try {
      await api(token, "/api/admin/promo-codes", {
        method: "POST",
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          influencer_name: name.trim(),
          influencer_email: email.trim().toLowerCase(),
          discount_percent: parseInt(discount || "10", 10),
          commission_eur: parseFloat(commission || "1"),
        }),
      });
      reset();
      onCreated();
    } catch (e: any) {
      Alert.alert("Create failed", e?.message || "Try again");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.modalWrap} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={s.modalCard}>
          <Text style={s.modalTitle}>New promo code</Text>
          <Field label="Code" value={code} onChangeText={(v) => setCode(v.toUpperCase())} placeholder="e.g. JOHN10" autoCapitalize="characters" />
          <Field label="Influencer name" value={name} onChangeText={setName} placeholder="e.g. John Doe" />
          <Field label="Influencer email" value={email} onChangeText={setEmail} placeholder="john@example.com" keyboardType="email-address" autoCapitalize="none" />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Field label="Discount %" value={discount} onChangeText={setDiscount} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Commission €" value={commission} onChangeText={setCommission} keyboardType="decimal-pad" />
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
            <TouchableOpacity style={[s.modalBtn, s.modalCancel]} onPress={() => { reset(); onClose(); }}>
              <Text style={s.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.modalBtn, s.modalSave]} onPress={submit} disabled={saving}>
              {saving ? <ActivityIndicator color="#0A0A0A" /> : <Text style={s.modalSaveText}>Create</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field(props: any) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.fieldLabel}>{props.label}</Text>
      <TextInput {...props} placeholderTextColor={colors.textDim} style={s.input} />
    </View>
  );
}

const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
  title: { color: colors.text, fontSize: 26, fontWeight: "900", flex: 1 },
  adminBadge: { backgroundColor: colors.primaryGlow, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderColor: colors.primary, borderWidth: 1 },
  adminBadgeText: { color: colors.primary, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },

  tabs: { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  tabBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
  tabBtnActive: { backgroundColor: colors.primaryGlow, borderColor: colors.primary },
  tabText: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  tabTextActive: { color: colors.primary },

  scroll: { padding: 16, paddingBottom: 40 },

  gridRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 16, padding: 14, borderColor: colors.border, borderWidth: 1 },
  statCardAccent: { borderColor: colors.accent },
  statHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  statLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  statValue: { color: colors.text, fontSize: 22, fontWeight: "900" },
  statHint: { color: colors.textDim, fontSize: 10, marginTop: 2 },

  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 14, marginBottom: 16 },
  primaryBtnText: { color: "#0A0A0A", fontWeight: "800", fontSize: 14 },

  empty: { backgroundColor: colors.surface, padding: 22, borderRadius: 16, borderColor: colors.border, borderWidth: 1 },
  emptyText: { color: colors.textMuted, textAlign: "center" },

  card: { backgroundColor: colors.surface, padding: 16, borderRadius: 16, borderColor: colors.border, borderWidth: 1, marginBottom: 12 },
  cardHead: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  codeLabel: { color: colors.text, fontSize: 18, fontWeight: "900", letterSpacing: 1 },
  influencer: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  statusOn: { backgroundColor: "rgba(16,185,129,0.15)", borderColor: colors.success },
  statusOff: { backgroundColor: "rgba(113,113,122,0.15)", borderColor: colors.border },
  statusOwed: { backgroundColor: "rgba(245,158,11,0.15)", borderColor: colors.accent },
  statusText: { fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  statusOnText: { color: colors.success },
  statusOffText: { color: colors.textMuted },
  statusOwedText: { color: colors.accent },
  rowMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  meta: { color: colors.textMuted, fontSize: 13 },
  metaDot: { color: colors.textDim },
  actions: { flexDirection: "row", gap: 8 },
  iconBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderWidth: 1 },
  iconBtnText: { color: colors.text, fontSize: 13, fontWeight: "700" },

  statsRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  miniStat: { flex: 1, backgroundColor: colors.surfaceElevated, padding: 10, borderRadius: 10, borderColor: colors.border, borderWidth: 1 },
  miniLabel: { color: colors.textDim, fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  miniValue: { color: colors.text, fontSize: 16, fontWeight: "800", marginTop: 2 },
  lastPayout: { color: colors.textDim, fontSize: 11, marginBottom: 10 },
  payoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary, paddingVertical: 12, borderRadius: 12 },
  payoutBtnDisabled: { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderWidth: 1 },
  payoutBtnText: { color: "#0A0A0A", fontWeight: "800" },

  earningRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, padding: 14, borderRadius: 12, borderColor: colors.border, borderWidth: 1, marginBottom: 8 },
  earningCode: { color: colors.text, fontWeight: "800", letterSpacing: 1 },
  earningDate: { color: colors.textDim, fontSize: 11, marginTop: 2 },
  earningAmount: { color: colors.primary, fontSize: 16, fontWeight: "900" },
  earningStatus: { fontSize: 10, fontWeight: "800", letterSpacing: 1, marginTop: 2 },

  modalWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  modalCard: { backgroundColor: colors.surface, padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderColor: colors.border, borderWidth: 1 },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: "900", marginBottom: 16 },
  fieldLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 6 },
  input: { backgroundColor: colors.surfaceElevated, color: colors.text, padding: 12, borderRadius: 10, borderColor: colors.border, borderWidth: 1 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  modalCancel: { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderWidth: 1 },
  modalCancelText: { color: colors.text, fontWeight: "700" },
  modalSave: { backgroundColor: colors.primary },
  modalSaveText: { color: "#0A0A0A", fontWeight: "800" },
});
