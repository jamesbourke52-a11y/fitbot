import { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Modal, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  Image, RefreshControl, Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LineChart, Grid } from "react-native-svg-charts";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import {
  TrendingUp, Ruler, Camera, Dumbbell, Share2, Plus, Trophy,
  Flame, ChevronRight, X, Check,
} from "lucide-react-native";
import { useAuth, api } from "../../src/auth";
import { colors } from "../../src/theme";

type Tab = "overview" | "body" | "photos" | "strength";

const UNIT_LABELS = {
  metric: { weight: "kg", length: "cm" },
  imperial: { weight: "lb", length: "in" },
};

export default function Progress() {
  const { token } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [prefs, setPrefs] = useState<{ units: "metric" | "imperial"; starting_level: number }>({ units: "metric", starting_level: 1 });
  const [level, setLevel] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [weights, setWeights] = useState<any[]>([]);
  const [measurements, setMeasurements] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [strength, setStrength] = useState<any>({ entries: [], prs: [] });
  const [measFields, setMeasFields] = useState<string[]>([]);

  // Modal state
  const [showWeight, setShowWeight] = useState(false);
  const [showMeas, setShowMeas] = useState(false);
  const [showStrength, setShowStrength] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [p, lv, s, w, m, ph, st] = await Promise.all([
        api(token, "/api/me/prefs"),
        api(token, "/api/me/level"),
        api(token, "/api/progress/summary"),
        api(token, "/api/progress/weight"),
        api(token, "/api/progress/measurements"),
        api(token, "/api/progress/photos"),
        api(token, "/api/progress/strength"),
      ]);
      setPrefs(p);
      setLevel(lv);
      setSummary(s);
      setWeights(w.entries || []);
      setMeasurements(m.entries || []);
      setMeasFields(m.fields || []);
      setPhotos(ph.photos || []);
      setStrength(st);
    } catch (e: any) {
      Alert.alert("Load failed", e?.message || "Retry");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const toggleUnit = async () => {
    const next = prefs.units === "metric" ? "imperial" : "metric";
    try {
      await api(token, "/api/me/prefs", { method: "PATCH", body: JSON.stringify({ units: next }) });
      load();
    } catch (e: any) { Alert.alert("Update failed", e.message); }
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.primary} /></View>;

  const units = prefs.units || "metric";
  const weightUnit = UNIT_LABELS[units].weight;
  const lengthUnit = UNIT_LABELS[units].length;

  return (
    <SafeAreaView style={s.c} edges={["top"]}>
      <View style={s.header}>
        <View>
          <Text style={s.kicker}>PROGRESS</Text>
          <Text style={s.title}>Your journey</Text>
        </View>
        <TouchableOpacity style={s.unitBtn} onPress={toggleUnit}>
          <Text style={s.unitBtnText}>{units === "metric" ? "KG · CM" : "LB · IN"}</Text>
        </TouchableOpacity>
      </View>

      <View style={s.tabs}>
        {(["overview", "body", "photos", "strength"] as Tab[]).map((t) => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={[s.tabBtn, tab === t && s.tabBtnActive]}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t === "overview" ? "Overview" : t === "body" ? "Body" : t === "photos" ? "Photos" : "Strength"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl tintColor={colors.primary} refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {tab === "overview" && (
          <View>
            {level && (
              <TouchableOpacity style={s.levelCard} onPress={() => router.push("/level-up")} activeOpacity={0.85}>
                <View style={s.levelHead}>
                  <Text style={{ fontSize: 40 }}>{level.level.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.levelName}>{level.level.name}</Text>
                    <Text style={s.levelDesc}>{level.level.desc}</Text>
                  </View>
                  <ChevronRight color={colors.primary} size={22} />
                </View>
                <View style={s.xpBar}>
                  <View style={[s.xpFill, { width: `${level.progress_pct}%`, backgroundColor: level.level.color }]} />
                </View>
                <View style={s.xpFoot}>
                  <Text style={s.xpText}>{level.xp} XP</Text>
                  {level.next_level && (
                    <Text style={s.xpTextDim}>{level.next_level.min_xp - level.xp} XP to {level.next_level.name}</Text>
                  )}
                </View>
              </TouchableOpacity>
            )}

            <View style={s.statsGrid}>
              <StatBox icon={<TrendingUp color={colors.primary} size={16} />} label="Weight logs" value={summary?.weight_count || 0} />
              <StatBox icon={<Ruler color={colors.primary} size={16} />} label="Measurements" value={summary?.measurement_count || 0} />
              <StatBox icon={<Camera color={colors.primary} size={16} />} label="Photos" value={summary?.photo_count || 0} />
              <StatBox icon={<Dumbbell color={colors.primary} size={16} />} label="Strength logs" value={summary?.strength_count || 0} />
            </View>

            {summary?.insight && (
              <View style={s.insight}>
                <Flame color={colors.accent} size={18} />
                <Text style={s.insightText}>{summary.insight}</Text>
              </View>
            )}

            <TouchableOpacity style={s.bigCTA} onPress={() => setShowShare(true)}>
              <Share2 color="#0A0A0A" size={18} />
              <Text style={s.bigCTAText}>Create transformation card</Text>
            </TouchableOpacity>

            <View style={{ height: 20 }} />
            <Text style={s.sectionTitle}>RECENT WEIGHT TREND</Text>
            {weights.length >= 2 ? (
              <View style={s.chartWrap}>
                <LineChart
                  style={{ height: 120 }}
                  data={[...weights].reverse().map((w: any) => w.weight_display || 0)}
                  svg={{ stroke: colors.primary, strokeWidth: 3 }}
                  contentInset={{ top: 12, bottom: 12 }}
                >
                  <Grid svg={{ stroke: colors.border }} />
                </LineChart>
                <View style={s.chartLegend}>
                  <Text style={s.chartLabel}>{weights[weights.length - 1].weight_display} {weightUnit}</Text>
                  <Text style={s.chartLabelMuted}>→</Text>
                  <Text style={s.chartLabel}>{weights[0].weight_display} {weightUnit}</Text>
                </View>
              </View>
            ) : (
              <View style={s.empty}><Text style={s.emptyText}>Log at least 2 weights to see a trend.</Text></View>
            )}
          </View>
        )}

        {tab === "body" && (
          <View>
            <View style={s.rowBtns}>
              <TouchableOpacity style={s.primaryBtn} onPress={() => setShowWeight(true)}>
                <Plus color="#0A0A0A" size={18} /><Text style={s.primaryBtnText}>Log weight</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.primaryBtn} onPress={() => setShowMeas(true)}>
                <Plus color="#0A0A0A" size={18} /><Text style={s.primaryBtnText}>Log measurements</Text>
              </TouchableOpacity>
            </View>

            <Text style={s.sectionTitle}>WEIGHT HISTORY</Text>
            {weights.length === 0 ? (
              <View style={s.empty}><Text style={s.emptyText}>No weights logged yet.</Text></View>
            ) : weights.map((w: any) => (
              <View key={w.id} style={s.row}>
                <View>
                  <Text style={s.rowValue}>{w.weight_display} {weightUnit}</Text>
                  <Text style={s.rowDate}>{new Date(w.logged_at).toLocaleDateString()}</Text>
                </View>
                {w.note && <Text style={s.rowNote}>{w.note}</Text>}
              </View>
            ))}

            <Text style={[s.sectionTitle, { marginTop: 24 }]}>MEASUREMENT HISTORY</Text>
            {measurements.length === 0 ? (
              <View style={s.empty}><Text style={s.emptyText}>No measurements yet.</Text></View>
            ) : measurements.map((m: any) => (
              <View key={m.id} style={s.cardBlock}>
                <Text style={s.rowDate}>{new Date(m.logged_at).toLocaleDateString()}</Text>
                <View style={s.measGrid}>
                  {Object.entries(m.values_display || {}).map(([k, v]: any) => (
                    <View key={k} style={s.measChip}>
                      <Text style={s.measKey}>{k.replace("_", " ")}</Text>
                      <Text style={s.measVal}>{v} {lengthUnit}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        {tab === "photos" && (
          <PhotosTab token={token} photos={photos} onReload={load} />
        )}

        {tab === "strength" && (
          <View>
            <TouchableOpacity style={s.primaryBtn} onPress={() => setShowStrength(true)}>
              <Plus color="#0A0A0A" size={18} /><Text style={s.primaryBtnText}>Log a lift</Text>
            </TouchableOpacity>

            {strength.prs?.length > 0 && (
              <>
                <Text style={[s.sectionTitle, { marginTop: 20 }]}>CURRENT PRS</Text>
                {strength.prs.map((pr: any) => (
                  <View key={pr.id} style={s.prRow}>
                    <Trophy color={colors.primary} size={20} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.prExercise}>{pr.exercise}</Text>
                      <Text style={s.rowDate}>{new Date(pr.logged_at).toLocaleDateString()}</Text>
                    </View>
                    <Text style={s.prWeight}>{pr.weight_display} {weightUnit} × {pr.reps}</Text>
                  </View>
                ))}
              </>
            )}

            <Text style={[s.sectionTitle, { marginTop: 24 }]}>ALL LIFTS</Text>
            {strength.entries?.length === 0 ? (
              <View style={s.empty}><Text style={s.emptyText}>Log your first lift.</Text></View>
            ) : strength.entries?.map((e: any) => (
              <View key={e.id} style={s.row}>
                <View>
                  <Text style={s.rowValue}>{e.exercise}</Text>
                  <Text style={s.rowDate}>{new Date(e.logged_at).toLocaleDateString()}</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  {e.is_pr && <View style={s.prPill}><Text style={s.prPillText}>PR</Text></View>}
                  <Text style={s.rowValue}>{e.weight_display} {weightUnit} × {e.reps}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <WeightModal visible={showWeight} token={token} unit={units} onClose={() => setShowWeight(false)} onDone={() => { setShowWeight(false); load(); }} />
      <MeasurementsModal visible={showMeas} token={token} unit={units} fields={measFields} onClose={() => setShowMeas(false)} onDone={() => { setShowMeas(false); load(); }} />
      <StrengthModal visible={showStrength} token={token} unit={units} onClose={() => setShowStrength(false)} onDone={() => { setShowStrength(false); load(); }} />
      <ShareCardModal visible={showShare} token={token} unit={units} onClose={() => setShowShare(false)} />
    </SafeAreaView>
  );
}

/* ------------- Sub-components ------------- */

function StatBox({ icon, label, value }: any) {
  return (
    <View style={s.statBox}>
      <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>{icon}<Text style={s.statLabel}>{label}</Text></View>
      <Text style={s.statValue}>{value}</Text>
    </View>
  );
}

function PhotosTab({ token, photos, onReload }: any) {
  const [uploading, setUploading] = useState(false);

  const pick = async (pose: string) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Photo library permission needed"); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true, quality: 0.6, aspect: [3, 4],
    });
    if (result.canceled || !result.assets?.[0]?.base64) return;
    setUploading(true);
    try {
      await api(token, "/api/progress/photos", {
        method: "POST",
        body: JSON.stringify({
          image: `data:image/jpeg;base64,${result.assets[0].base64}`,
          pose,
        }),
      });
      onReload();
    } catch (e: any) { Alert.alert("Upload failed", e.message); }
    setUploading(false);
  };

  const byPose = (p: string) => photos.filter((x: any) => x.pose === p);

  return (
    <View>
      <Text style={s.emptyText}>Tap to add a progress photo (front / side / back).</Text>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
        {["front", "side", "back"].map((pose) => (
          <TouchableOpacity key={pose} style={s.posePick} onPress={() => pick(pose)} disabled={uploading}>
            <Camera color={colors.primary} size={20} />
            <Text style={s.poseLabel}>{pose.toUpperCase()}</Text>
            <Text style={s.poseCount}>{byPose(pose).length}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {uploading && <ActivityIndicator style={{ marginTop: 16 }} color={colors.primary} />}

      {["front", "side", "back"].map((pose) => {
        const pics = byPose(pose);
        if (pics.length === 0) return null;
        return (
          <View key={pose} style={{ marginTop: 24 }}>
            <Text style={s.sectionTitle}>{pose.toUpperCase()}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {pics.map((p: any) => (
                <View key={p.id} style={s.thumb}>
                  <Image source={{ uri: p.image }} style={s.thumbImg} />
                  <Text style={s.thumbDate}>{new Date(p.logged_at).toLocaleDateString()}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        );
      })}
    </View>
  );
}

/* ------------- Modals ------------- */

function WeightModal({ visible, token, unit, onClose, onDone }: any) {
  const [w, setW] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!w) return;
    setSaving(true);
    try {
      await api(token, "/api/progress/weight", { method: "POST", body: JSON.stringify({ weight: parseFloat(w), unit, note }) });
      setW(""); setNote(""); onDone();
    } catch (e: any) { Alert.alert("Save failed", e.message); }
    setSaving(false);
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.modalBg} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={s.modalCard}>
          <View style={s.modalHead}><Text style={s.modalTitle}>Log weight</Text><TouchableOpacity onPress={onClose}><X color={colors.textMuted} size={22} /></TouchableOpacity></View>
          <Text style={s.field}>Weight ({unit === "metric" ? "kg" : "lb"})</Text>
          <TextInput style={s.input} value={w} onChangeText={setW} keyboardType="decimal-pad" placeholder={unit === "metric" ? "75.0" : "165"} placeholderTextColor={colors.textDim} />
          <Text style={s.field}>Note (optional)</Text>
          <TextInput style={s.input} value={note} onChangeText={setNote} placeholder="Post-workout weigh-in" placeholderTextColor={colors.textDim} />
          <TouchableOpacity style={s.saveBtn} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color="#000" /> : <Text style={s.saveBtnText}>Save</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function MeasurementsModal({ visible, token, unit, fields, onClose, onDone }: any) {
  const [vals, setVals] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const values: Record<string, number> = {};
    for (const [k, v] of Object.entries(vals)) if (v) values[k] = parseFloat(v);
    if (Object.keys(values).length === 0) return;
    setSaving(true);
    try {
      await api(token, "/api/progress/measurements", { method: "POST", body: JSON.stringify({ unit, values }) });
      setVals({}); onDone();
    } catch (e: any) { Alert.alert("Save failed", e.message); }
    setSaving(false);
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.modalBg} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={s.modalCard}>
          <View style={s.modalHead}><Text style={s.modalTitle}>Log measurements ({unit === "metric" ? "cm" : "in"})</Text><TouchableOpacity onPress={onClose}><X color={colors.textMuted} size={22} /></TouchableOpacity></View>
          <ScrollView style={{ maxHeight: 400 }}>
            {fields.map((f: string) => (
              <View key={f}>
                <Text style={s.field}>{f.replace("_", " ")}</Text>
                <TextInput style={s.input} value={vals[f] || ""} onChangeText={(v) => setVals({ ...vals, [f]: v })} keyboardType="decimal-pad" placeholder="—" placeholderTextColor={colors.textDim} />
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={s.saveBtn} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color="#000" /> : <Text style={s.saveBtnText}>Save</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function StrengthModal({ visible, token, unit, onClose, onDone }: any) {
  const [ex, setEx] = useState("");
  const [w, setW] = useState("");
  const [reps, setReps] = useState("5");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!ex || !w) return;
    setSaving(true);
    try {
      const res = await api(token, "/api/progress/strength", { method: "POST", body: JSON.stringify({ exercise: ex, weight: parseFloat(w), reps: parseInt(reps) || 1, unit }) });
      setEx(""); setW(""); setReps("5");
      if (res.is_pr) Alert.alert("🏆 NEW PR!", `${res.entry.exercise} — ${w} ${unit === "metric" ? "kg" : "lb"} × ${reps}`);
      onDone();
    } catch (e: any) { Alert.alert("Save failed", e.message); }
    setSaving(false);
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.modalBg} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={s.modalCard}>
          <View style={s.modalHead}><Text style={s.modalTitle}>Log a lift</Text><TouchableOpacity onPress={onClose}><X color={colors.textMuted} size={22} /></TouchableOpacity></View>
          <Text style={s.field}>Exercise</Text>
          <TextInput style={s.input} value={ex} onChangeText={setEx} placeholder="Bench press" placeholderTextColor={colors.textDim} />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.field}>Weight ({unit === "metric" ? "kg" : "lb"})</Text>
              <TextInput style={s.input} value={w} onChangeText={setW} keyboardType="decimal-pad" placeholder="80" placeholderTextColor={colors.textDim} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.field}>Reps</Text>
              <TextInput style={s.input} value={reps} onChangeText={setReps} keyboardType="number-pad" placeholder="5" placeholderTextColor={colors.textDim} />
            </View>
          </View>
          <TouchableOpacity style={s.saveBtn} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color="#000" /> : <Text style={s.saveBtnText}>Save</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ShareCardModal({ visible, token, unit, onClose }: any) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = async (d: number) => {
    setLoading(true); setDays(d);
    try {
      const res = await api(token, `/api/progress/share-card/${d}`);
      setData(res);
    } catch (e: any) { Alert.alert("Load failed", e.message); }
    setLoading(false);
  };

  useEffect(() => { if (visible) load(30); }, [visible]);

  const share = async () => {
    try {
      await Share.share({ message: `My ${days}-day FitLux transformation 💪 fitlux.fitness` });
    } catch {}
  };

  const beforeImg = data?.photos_before?.[0]?.image;
  const afterImg = data?.photos_after?.[0]?.image;
  const weightBefore = data?.weight_before;
  const weightAfter = data?.weight_after;
  const deltaKg = (weightBefore && weightAfter) ? (weightAfter.weight_kg - weightBefore.weight_kg) : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.modalBg}>
        <View style={s.shareCard}>
          <View style={s.modalHead}><Text style={s.modalTitle}>Transformation card</Text><TouchableOpacity onPress={onClose}><X color={colors.textMuted} size={22} /></TouchableOpacity></View>
          <View style={s.daysRow}>
            {[30, 60, 90].map((d) => (
              <TouchableOpacity key={d} style={[s.dayChip, days === d && s.dayChipActive]} onPress={() => load(d)}>
                <Text style={[s.dayChipText, days === d && s.dayChipTextActive]}>{d} days</Text>
              </TouchableOpacity>
            ))}
          </View>
          {loading ? <ActivityIndicator color={colors.primary} /> : data && (
            <View style={s.posterCard}>
              <Text style={s.posterKicker}>FITLUX · {days} DAY TRANSFORMATION</Text>
              <Text style={s.posterName}>{data.name}</Text>
              <View style={s.posterPhotos}>
                <View style={s.posterPhotoWrap}>
                  <Text style={s.posterLabel}>BEFORE</Text>
                  {beforeImg ? <Image source={{ uri: beforeImg }} style={s.posterImg} /> : <View style={[s.posterImg, s.posterPlaceholder]}><Text style={s.emptyText}>Add photo</Text></View>}
                </View>
                <View style={s.posterPhotoWrap}>
                  <Text style={s.posterLabel}>NOW</Text>
                  {afterImg ? <Image source={{ uri: afterImg }} style={s.posterImg} /> : <View style={[s.posterImg, s.posterPlaceholder]}><Text style={s.emptyText}>Add photo</Text></View>}
                </View>
              </View>
              {deltaKg !== null && (
                <View style={s.posterStat}>
                  <Text style={s.posterStatLabel}>WEIGHT Δ</Text>
                  <Text style={s.posterStatVal}>
                    {deltaKg >= 0 ? "+" : ""}
                    {(unit === "imperial" ? deltaKg * 2.2046 : deltaKg).toFixed(1)} {unit === "metric" ? "kg" : "lb"}
                  </Text>
                </View>
              )}
              <Text style={s.posterFoot}>fitlux.fitness</Text>
            </View>
          )}
          <TouchableOpacity style={s.saveBtn} onPress={share} disabled={!data?.ready}>
            <Share2 color="#000" size={18} />
            <Text style={s.saveBtnText}>{data?.ready ? "Share" : "Need before + after photos"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  kicker: { color: colors.primary, fontSize: 11, letterSpacing: 3, fontWeight: "800" },
  title: { color: colors.text, fontSize: 28, fontWeight: "900", marginTop: 4 },
  unitBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
  unitBtnText: { color: colors.text, fontSize: 11, fontWeight: "800", letterSpacing: 1 },

  tabs: { flexDirection: "row", paddingHorizontal: 20, gap: 8, marginBottom: 12 },
  tabBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
  tabBtnActive: { backgroundColor: colors.primaryGlow, borderColor: colors.primary },
  tabText: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  tabTextActive: { color: colors.primary },

  scroll: { padding: 20, paddingBottom: 40 },

  levelCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 18, borderColor: colors.primary, borderWidth: 1, marginBottom: 16 },
  levelHead: { flexDirection: "row", alignItems: "center", gap: 14 },
  levelName: { color: colors.text, fontSize: 22, fontWeight: "900" },
  levelDesc: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  xpBar: { height: 8, backgroundColor: colors.surfaceElevated, borderRadius: 4, marginTop: 14, overflow: "hidden" },
  xpFill: { height: 8 },
  xpFoot: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  xpText: { color: colors.text, fontSize: 12, fontWeight: "800" },
  xpTextDim: { color: colors.textDim, fontSize: 11 },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statBox: { flex: 1, minWidth: "45%", backgroundColor: colors.surface, padding: 14, borderRadius: 14, borderColor: colors.border, borderWidth: 1 },
  statLabel: { color: colors.textMuted, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  statValue: { color: colors.text, fontSize: 22, fontWeight: "900", marginTop: 4 },
  insight: { flexDirection: "row", gap: 8, alignItems: "center", marginTop: 14, padding: 12, backgroundColor: "rgba(245,158,11,0.12)", borderRadius: 12, borderColor: colors.accent, borderWidth: 1 },
  insightText: { color: colors.text, fontWeight: "700", flex: 1 },

  bigCTA: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary, marginTop: 18, paddingVertical: 14, borderRadius: 14 },
  bigCTAText: { color: "#0A0A0A", fontWeight: "800" },

  sectionTitle: { color: colors.textDim, fontSize: 11, fontWeight: "800", letterSpacing: 2, marginBottom: 10, marginTop: 8 },
  chartWrap: { backgroundColor: colors.surface, padding: 16, borderRadius: 14, borderColor: colors.border, borderWidth: 1 },
  chartLegend: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  chartLabel: { color: colors.text, fontWeight: "800" },
  chartLabelMuted: { color: colors.textDim },

  rowBtns: { flexDirection: "row", gap: 10, marginBottom: 18 },
  primaryBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.primary, paddingVertical: 12, borderRadius: 12 },
  primaryBtnText: { color: "#0A0A0A", fontWeight: "800", fontSize: 13 },
  empty: { backgroundColor: colors.surface, padding: 18, borderRadius: 14, borderColor: colors.border, borderWidth: 1, alignItems: "center" },
  emptyText: { color: colors.textMuted, textAlign: "center" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: colors.surface, padding: 14, borderRadius: 12, borderColor: colors.border, borderWidth: 1, marginBottom: 8 },
  rowValue: { color: colors.text, fontWeight: "800" },
  rowDate: { color: colors.textDim, fontSize: 11, marginTop: 2 },
  rowNote: { color: colors.textMuted, fontSize: 12, fontStyle: "italic" },
  cardBlock: { backgroundColor: colors.surface, padding: 14, borderRadius: 12, borderColor: colors.border, borderWidth: 1, marginBottom: 10 },
  measGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  measChip: { backgroundColor: colors.surfaceElevated, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderColor: colors.border, borderWidth: 1 },
  measKey: { color: colors.textDim, fontSize: 9, textTransform: "uppercase" },
  measVal: { color: colors.text, fontWeight: "800", fontSize: 13 },

  posePick: { flex: 1, alignItems: "center", backgroundColor: colors.surface, padding: 16, borderRadius: 14, borderColor: colors.border, borderWidth: 1 },
  poseLabel: { color: colors.text, fontSize: 11, fontWeight: "800", letterSpacing: 1, marginTop: 6 },
  poseCount: { color: colors.primary, fontSize: 16, fontWeight: "900", marginTop: 2 },
  thumb: { alignItems: "center" },
  thumbImg: { width: 120, height: 160, borderRadius: 12, backgroundColor: colors.surfaceElevated },
  thumbDate: { color: colors.textDim, fontSize: 10, marginTop: 4 },

  prRow: { flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: colors.surface, padding: 14, borderRadius: 12, borderColor: colors.primary, borderWidth: 1, marginBottom: 8 },
  prExercise: { color: colors.text, fontWeight: "800", textTransform: "capitalize" },
  prWeight: { color: colors.primary, fontWeight: "900" },
  prPill: { backgroundColor: colors.primaryGlow, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  prPillText: { color: colors.primary, fontSize: 9, fontWeight: "900", letterSpacing: 1 },

  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.surfaceElevated, padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderColor: colors.border, borderWidth: 1 },
  modalHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: "900" },
  field: { color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 6, marginTop: 8, textTransform: "capitalize" },
  input: { backgroundColor: colors.surface, color: colors.text, padding: 12, borderRadius: 10, borderColor: colors.border, borderWidth: 1 },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary, padding: 14, borderRadius: 12, marginTop: 18 },
  saveBtnText: { color: "#000", fontWeight: "900" },

  shareCard: { backgroundColor: colors.surfaceElevated, padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderColor: colors.border, borderWidth: 1, maxHeight: "92%" },
  daysRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  dayChip: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, alignItems: "center" },
  dayChipActive: { backgroundColor: colors.primaryGlow, borderColor: colors.primary },
  dayChipText: { color: colors.textMuted, fontWeight: "700" },
  dayChipTextActive: { color: colors.primary },
  posterCard: { backgroundColor: "#0A0A0A", padding: 18, borderRadius: 20, borderColor: colors.primary, borderWidth: 2 },
  posterKicker: { color: colors.primary, fontSize: 10, fontWeight: "900", letterSpacing: 2, textAlign: "center" },
  posterName: { color: colors.text, fontSize: 20, fontWeight: "900", textAlign: "center", marginTop: 4, marginBottom: 12 },
  posterPhotos: { flexDirection: "row", gap: 10 },
  posterPhotoWrap: { flex: 1 },
  posterLabel: { color: colors.textDim, fontSize: 10, fontWeight: "800", letterSpacing: 2, textAlign: "center", marginBottom: 6 },
  posterImg: { width: "100%", height: 200, borderRadius: 10, backgroundColor: colors.surface },
  posterPlaceholder: { alignItems: "center", justifyContent: "center" },
  posterStat: { marginTop: 14, alignItems: "center" },
  posterStatLabel: { color: colors.textDim, fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  posterStatVal: { color: colors.primary, fontSize: 30, fontWeight: "900", marginTop: 4 },
  posterFoot: { color: colors.textDim, fontSize: 11, textAlign: "center", marginTop: 14, letterSpacing: 2 },
});
