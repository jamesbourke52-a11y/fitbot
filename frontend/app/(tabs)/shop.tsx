import { useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  ActivityIndicator, Linking, Modal, FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ShoppingBag, X, ExternalLink, Check, Globe, Info } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth, api } from "../../src/auth";
import { colors } from "../../src/theme";

type Product = {
  id: string; name: string; tagline: string; description: string; price: string;
  category: string; image: string; buy_url: string; benefits: string[];
};

type Category = { id: string; label: string; image: string };

const REGION_KEY = "fitlux_region";
const CATEGORY_KEY = "fitlux_category";

const REGION_LABEL: Record<string, string> = {
  UK: "United Kingdom · amazon.co.uk",
  CA: "Canada · amazon.ca",
  DE: "Germany · amazon.de",
  FR: "France · amazon.fr",
  IT: "Italy · amazon.it",
  NL: "Netherlands · amazon.nl",
  PL: "Poland · amazon.pl",
  ES: "Spain · amazon.es",
  SE: "Sweden · amazon.se",
};
const REGION_FLAG: Record<string, string> = {
  UK: "🇬🇧", CA: "🇨🇦", DE: "🇩🇪", FR: "🇫🇷", IT: "🇮🇹",
  NL: "🇳🇱", PL: "🇵🇱", ES: "🇪🇸", SE: "🇸🇪",
};

export default function Shop() {
  const { token } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCat, setActiveCat] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Product | null>(null);
  const [region, setRegion] = useState<string>("UK");
  const [regions, setRegions] = useState<string[]>(["UK"]);
  const [disclosure, setDisclosure] = useState<string>("");
  const [regionPicker, setRegionPicker] = useState(false);

  const load = async (r: string) => {
    setLoading(true);
    try {
      const data = await api(token, `/api/products?region=${r}`);
      setProducts(data.products);
      setCategories(data.categories || []);
      setRegions(data.supported_regions);
      setDisclosure(data.disclosure);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    (async () => {
      const storedR = (await AsyncStorage.getItem(REGION_KEY)) || "UK";
      const storedC = (await AsyncStorage.getItem(CATEGORY_KEY)) || "";
      setRegion(storedR);
      setActiveCat(storedC);
      load(storedR);
    })();
  }, []);

  const pickRegion = async (r: string) => {
    setRegion(r);
    await AsyncStorage.setItem(REGION_KEY, r);
    setRegionPicker(false);
    load(r);
  };

  const pickCategory = async (c: string) => {
    setActiveCat(c);
    await AsyncStorage.setItem(CATEGORY_KEY, c);
  };

  const filtered = useMemo(
    () => activeCat ? products.filter((p) => p.category === activeCat) : products,
    [products, activeCat]
  );

  const buy = (url: string) => Linking.openURL(url);

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.primary} /></View>;

  const headerArea = (
    <View>
      <View style={s.headerRow}>
        <View style={s.head}>
          <ShoppingBag color={colors.primary} size={20} />
          <Text style={s.kicker}>FITLUX SHOP</Text>
        </View>
        <TouchableOpacity testID="region-btn" style={s.regionBtn} onPress={() => setRegionPicker(true)}>
          <Text style={{ fontSize: 14 }}>{REGION_FLAG[region] || "🌍"}</Text>
          <Text style={s.regionBtnText}>{region}</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.title}>Best sellers</Text>
      <Text style={s.subtitle}>Curated picks · ships from Amazon {region}</Text>

      <View style={s.discBanner} testID="amazon-disclosure-banner">
        <Info color={colors.primary} size={14} />
        <Text style={s.discBannerText}>
          <Text style={s.discBannerStrong}>Affiliate disclosure: </Text>
          As an Amazon Associate, FitLux earns from qualifying purchases made
          through the links below. Prices and availability come from Amazon
          at checkout.
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.tabsScroll}
        contentContainerStyle={s.tabsContainer}
      >
        <TouchableOpacity
          testID="cat-all"
          style={[s.catChip, activeCat === "" && s.catChipActive]}
          onPress={() => pickCategory("")}
        >
          <Text style={[s.catChipText, activeCat === "" && s.catChipTextActive]}>All</Text>
        </TouchableOpacity>
        {categories.map((c) => (
          <TouchableOpacity
            key={c.id}
            testID={`cat-${c.id}`}
            style={[s.catChip, activeCat === c.id && s.catChipActive]}
            onPress={() => pickCategory(c.id)}
          >
            <Text style={[s.catChipText, activeCat === c.id && s.catChipTextActive]}>
              {c.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={s.countLine}>
        {filtered.length} products{activeCat ? ` · ${categories.find((c) => c.id === activeCat)?.label}` : ""}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={s.c} edges={["top"]}>
      <FlatList
        ListHeaderComponent={headerArea}
        data={filtered}
        keyExtractor={(p) => p.id}
        numColumns={2}
        contentContainerStyle={s.listContent}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 20 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item: p }) => (
          <TouchableOpacity
            testID={`product-${p.id}`}
            style={s.card}
            onPress={() => setSelected(p)}
            activeOpacity={0.85}
          >
            <View style={s.imgWrap}>
              <Image source={{ uri: p.image }} style={s.img} />
            </View>
            <View style={s.cardBody}>
              <Text style={s.cat}>{(categories.find((c) => c.id === p.category)?.label || p.category).toUpperCase()}</Text>
              <Text style={s.name} numberOfLines={2}>{p.name}</Text>
              <Text style={s.tagline} numberOfLines={2}>{p.tagline}</Text>
              <View style={s.cardFoot}>
                <Text style={s.price}>{p.price}</Text>
                <View style={s.buyChip}><Text style={s.buyChipText}>View</Text></View>
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListFooterComponent={
          disclosure ? (
            <Text style={s.disclosure} testID="disclosure">{disclosure}</Text>
          ) : null
        }
      />

      {/* Product detail modal */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={s.modalBg}>
          <View style={s.modalCard}>
            <TouchableOpacity testID="modal-close" style={s.closeBtn} onPress={() => setSelected(null)}>
              <X color={colors.text} size={20} />
            </TouchableOpacity>
            {selected && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Image source={{ uri: selected.image }} style={s.modalImg} />
                <View style={{ padding: 20 }}>
                  <Text style={s.cat}>{(categories.find((c) => c.id === selected.category)?.label || selected.category).toUpperCase()}</Text>
                  <Text style={s.modalName}>{selected.name}</Text>
                  <Text style={s.modalTagline}>{selected.tagline}</Text>
                  <Text style={s.modalDesc}>{selected.description}</Text>
                  <Text style={s.benHead}>HIGHLIGHTS</Text>
                  {selected.benefits.map((b, i) => (
                    <View key={i} style={s.benRow}>
                      <Check color={colors.primary} size={16} />
                      <Text style={s.benText}>{b}</Text>
                    </View>
                  ))}
                  <View style={s.priceRow}>
                    <View>
                      <Text style={s.modalPrice}>{selected.price}</Text>
                      <Text style={s.priceNote}>List price · check Amazon for live price</Text>
                    </View>
                    <TouchableOpacity testID="buy-now-btn" style={s.buyBtn} onPress={() => buy(selected.buy_url)}>
                      <Text style={s.buyBtnText}>View on Amazon</Text>
                      <ExternalLink color="#000" size={16} />
                    </TouchableOpacity>
                  </View>
                  <Text style={s.disclosureModal}>{disclosure}</Text>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Region picker */}
      <Modal visible={regionPicker} transparent animationType="fade" onRequestClose={() => setRegionPicker(false)}>
        <View style={s.modalBg}>
          <View style={s.regionModal}>
            <View style={s.regionHead}>
              <Text style={s.modalTitle}>Choose your region</Text>
              <TouchableOpacity onPress={() => setRegionPicker(false)}>
                <X color={colors.textMuted} size={20} />
              </TouchableOpacity>
            </View>
            <Text style={s.regionSub}>Buy links route to your local Amazon</Text>
            <ScrollView style={{ maxHeight: 420 }}>
              {regions.map((r) => (
                <TouchableOpacity
                  key={r}
                  testID={`region-${r}`}
                  style={[s.regionRow, region === r && s.regionRowSel]}
                  onPress={() => pickRegion(r)}
                >
                  <Text style={{ fontSize: 18, marginRight: 8 }}>{REGION_FLAG[r] || "🌍"}</Text>
                  <Text style={[s.regionRowText, region === r && { color: colors.primary, fontWeight: "700" }]}>
                    {REGION_LABEL[r] || r}
                  </Text>
                  {region === r && <Check color={colors.primary} size={18} style={{ marginLeft: "auto" }} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  listContent: { paddingBottom: 60 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 8 },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  kicker: { color: colors.primary, fontSize: 11, letterSpacing: 3, fontWeight: "800" },
  regionBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderColor: colors.border, borderWidth: 1, backgroundColor: colors.surface },
  regionBtnText: { color: colors.text, fontSize: 12, fontWeight: "700" },
  title: { color: colors.text, fontSize: 30, fontWeight: "900", marginTop: 8, paddingHorizontal: 20 },
  subtitle: { color: colors.textMuted, marginTop: 4, marginBottom: 16, paddingHorizontal: 20 },
  discBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: colors.primaryGlow, borderColor: colors.primary, borderWidth: 1, borderRadius: 12, padding: 12, marginHorizontal: 20, marginBottom: 16 },
  discBannerText: { color: colors.text, fontSize: 12, lineHeight: 17, flex: 1 },
  discBannerStrong: { color: colors.primary, fontWeight: "800" },
  tabsScroll: { marginBottom: 12 },
  tabsContainer: { paddingHorizontal: 20, gap: 8 },
  catChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
  catChipActive: { backgroundColor: colors.primaryGlow, borderColor: colors.primary },
  catChipText: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  catChipTextActive: { color: colors.primary },
  countLine: { color: colors.textDim, fontSize: 11, paddingHorizontal: 20, marginBottom: 14, fontWeight: "700", letterSpacing: 1 },

  card: { flex: 1, backgroundColor: colors.surface, borderRadius: 20, overflow: "hidden", borderColor: colors.border, borderWidth: 1 },
  imgWrap: { height: 130, backgroundColor: "#0A0A0A", alignItems: "center", justifyContent: "center" },
  img: { width: "100%", height: "100%", resizeMode: "cover" },
  cardBody: { padding: 12 },
  cat: { color: colors.primary, fontSize: 9, letterSpacing: 1.5, fontWeight: "800" },
  name: { color: colors.text, fontSize: 14, fontWeight: "700", marginTop: 4, height: 36 },
  tagline: { color: colors.textMuted, fontSize: 11, marginTop: 2, height: 30 },
  cardFoot: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  price: { color: colors.text, fontWeight: "800", fontSize: 13 },
  buyChip: { backgroundColor: colors.primaryGlow, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  buyChipText: { color: colors.primary, fontSize: 11, fontWeight: "700" },
  disclosure: { color: colors.textDim, fontSize: 11, marginTop: 16, lineHeight: 16, fontStyle: "italic", textAlign: "center", paddingHorizontal: 24 },

  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.surfaceElevated, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "88%" },
  closeBtn: { position: "absolute", top: 12, right: 12, zIndex: 1, padding: 8, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 999 },
  modalImg: { width: "100%", height: 280, backgroundColor: "#0A0A0A" },
  modalName: { color: colors.text, fontSize: 24, fontWeight: "900", marginTop: 6 },
  modalTagline: { color: colors.primary, marginTop: 4, fontWeight: "600" },
  modalDesc: { color: colors.textMuted, marginTop: 14, lineHeight: 22 },
  benHead: { color: colors.textDim, fontSize: 11, letterSpacing: 2, fontWeight: "700", marginTop: 20, marginBottom: 8 },
  benRow: { flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 6 },
  benText: { color: colors.text },
  priceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 24 },
  modalPrice: { color: colors.text, fontSize: 24, fontWeight: "900" },
  priceNote: { color: colors.textDim, fontSize: 10, marginTop: 2, maxWidth: 160 },
  buyBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 999 },
  buyBtnText: { color: "#000", fontWeight: "800", fontSize: 14 },
  disclosureModal: { color: colors.textDim, fontSize: 11, marginTop: 18, lineHeight: 16, fontStyle: "italic" },

  regionModal: { backgroundColor: colors.surfaceElevated, padding: 22, borderRadius: 22, margin: 20, borderColor: colors.border, borderWidth: 1 },
  regionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: "800" },
  regionSub: { color: colors.textMuted, marginBottom: 14, fontSize: 13 },
  regionRow: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, borderColor: colors.border, borderWidth: 1, marginBottom: 8, backgroundColor: colors.surface },
  regionRowSel: { borderColor: colors.primary, backgroundColor: colors.primaryGlow },
  regionRowText: { color: colors.text, fontSize: 14 },
});
