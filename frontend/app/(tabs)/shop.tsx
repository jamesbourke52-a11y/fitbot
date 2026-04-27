import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  ActivityIndicator, Linking, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ShoppingBag, X, ExternalLink, Check } from "lucide-react-native";
import { useAuth, api } from "../../src/auth";
import { colors } from "../../src/theme";

type Product = {
  id: string; name: string; tagline: string; description: string; price: string;
  category: string; image: string; buy_url: string; benefits: string[];
};

export default function Shop() {
  const { token } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Product | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await api(token, "/api/products");
        setProducts(data.products);
      } finally { setLoading(false); }
    })();
  }, [token]);

  const buy = (url: string) => Linking.openURL(url);

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.primary} /></View>;

  return (
    <SafeAreaView style={s.c} edges={["top"]}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.head}>
          <ShoppingBag color={colors.primary} size={20} />
          <Text style={s.kicker}>FITLUX SHOP</Text>
        </View>
        <Text style={s.title}>Premium supplements</Text>
        <Text style={s.subtitle}>Curated products for serious results</Text>

        <View style={s.grid}>
          {products.map((p) => (
            <TouchableOpacity
              key={p.id}
              testID={`product-${p.id}`}
              style={s.card}
              onPress={() => setSelected(p)}
              activeOpacity={0.85}
            >
              <View style={s.imgWrap}>
                <Image source={{ uri: p.image }} style={s.img} />
              </View>
              <View style={s.cardBody}>
                <Text style={s.cat}>{p.category.toUpperCase()}</Text>
                <Text style={s.name} numberOfLines={1}>{p.name}</Text>
                <Text style={s.tagline} numberOfLines={2}>{p.tagline}</Text>
                <View style={s.cardFoot}>
                  <Text style={s.price}>{p.price}</Text>
                  <View style={s.buyChip}><Text style={s.buyChipText}>View</Text></View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

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
                  <Text style={s.cat}>{selected.category.toUpperCase()}</Text>
                  <Text style={s.modalName}>{selected.name}</Text>
                  <Text style={s.modalTagline}>{selected.tagline}</Text>
                  <Text style={s.modalDesc}>{selected.description}</Text>
                  <Text style={s.benHead}>BENEFITS</Text>
                  {selected.benefits.map((b, i) => (
                    <View key={i} style={s.benRow}>
                      <Check color={colors.primary} size={16} />
                      <Text style={s.benText}>{b}</Text>
                    </View>
                  ))}
                  <View style={s.priceRow}>
                    <Text style={s.modalPrice}>{selected.price}</Text>
                    <TouchableOpacity testID="buy-now-btn" style={s.buyBtn} onPress={() => buy(selected.buy_url)}>
                      <Text style={s.buyBtnText}>Buy now</Text>
                      <ExternalLink color="#000" size={16} />
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  kicker: { color: colors.primary, fontSize: 11, letterSpacing: 3, fontWeight: "800" },
  title: { color: colors.text, fontSize: 30, fontWeight: "900", marginTop: 8 },
  subtitle: { color: colors.textMuted, marginTop: 4, marginBottom: 20 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "space-between" },
  card: { width: "48%", backgroundColor: colors.surface, borderRadius: 20, overflow: "hidden", borderColor: colors.border, borderWidth: 1, marginBottom: 12 },
  imgWrap: { height: 130, backgroundColor: "#0A0A0A", alignItems: "center", justifyContent: "center" },
  img: { width: "100%", height: "100%", resizeMode: "cover" },
  cardBody: { padding: 12 },
  cat: { color: colors.primary, fontSize: 9, letterSpacing: 2, fontWeight: "800" },
  name: { color: colors.text, fontSize: 15, fontWeight: "700", marginTop: 4 },
  tagline: { color: colors.textMuted, fontSize: 12, marginTop: 2, height: 32 },
  cardFoot: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  price: { color: colors.text, fontWeight: "800" },
  buyChip: { backgroundColor: colors.primaryGlow, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  buyChipText: { color: colors.primary, fontSize: 11, fontWeight: "700" },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.surfaceElevated, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "88%" },
  closeBtn: { position: "absolute", top: 12, right: 12, zIndex: 1, padding: 8, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 999 },
  modalImg: { width: "100%", height: 280, backgroundColor: "#0A0A0A" },
  modalName: { color: colors.text, fontSize: 26, fontWeight: "900", marginTop: 6 },
  modalTagline: { color: colors.primary, marginTop: 4, fontWeight: "600" },
  modalDesc: { color: colors.textMuted, marginTop: 14, lineHeight: 22 },
  benHead: { color: colors.textDim, fontSize: 11, letterSpacing: 2, fontWeight: "700", marginTop: 20, marginBottom: 8 },
  benRow: { flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 6 },
  benText: { color: colors.text },
  priceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 24 },
  modalPrice: { color: colors.text, fontSize: 26, fontWeight: "900" },
  buyBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 999 },
  buyBtnText: { color: "#000", fontWeight: "800", fontSize: 15 },
});
