import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/src/store/auth-context";

const MAX_VISIBLE = 8;

type MenuItem = {
  key: string;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  accent: string;
  route?: string;
};

const MENU: MenuItem[] = [
  {
    key: "visit",
    label: "Visit",
    icon: "public",
    accent: "#2563EB",
    route: "/visit-dashboard",
  },
  { key: "sales", label: "Sales", icon: "trending-up", accent: "#EF4444" },
  {
    key: "perjalanan",
    label: "Perjalanan Dinas",
    icon: "flight",
    accent: "#F59E0B",
  },
  {
    key: "e-discount",
    label: "E-Discount",
    icon: "percent",
    accent: "#EC4899",
  },
  {
    key: "struktur",
    label: "Struktur",
    icon: "account-tree",
    accent: "#6366F1",
  },
  {
    key: "sponsorship",
    label: "Lampiran Sponsorship",
    icon: "description",
    accent: "#10B981",
  },
  {
    key: "expenses",
    label: "Advance & Expenses",
    icon: "payments",
    accent: "#7C3AED",
  },
  {
    key: "service",
    label: "Service Kendaraan",
    icon: "build",
    accent: "#475569",
  },
  { key: "stock", label: "Stock", icon: "inventory-2", accent: "#8B5E34" },
  {
    key: "report",
    label: "Sales Analysis Report",
    icon: "insert-chart",
    accent: "#0EA5E9",
  },
];

const ANNOUNCEMENT = {
  title: "Peluncuran Produk Baru: VitaFlow 500",
  body: "Pelajari materi penjualan dan ringkasan uji klinis terbaru di document library.",
  badge: "PENGUMUMAN BARU",
};

export default function PortalMenuScreen() {
  const { user, pegawai } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const welcomeName = (
    pegawai?.nama_peg ??
    user?.name ??
    user?.username ??
    "Medical Rep"
  ).toUpperCase();

  const showToggle = MENU.length > MAX_VISIBLE;
  const visibleItems = useMemo(() => {
    if (!showToggle) return MENU;
    return expanded ? MENU : MENU.slice(0, MAX_VISIBLE - 1);
  }, [expanded, showToggle]);

  const onMenuPress = (item: MenuItem) => {
    if (item.route) {
      router.push(item.route as never);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>M</Text>
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.welcomeText} numberOfLines={2}>
            Welcome, {welcomeName}
          </Text>
          <Text style={styles.welcomeSub}>Medical Representative Portal</Text>
        </View>
        <TouchableOpacity
          style={styles.profileBtn}
          onPress={() => router.push("/(tabs)/profile" as never)}
          hitSlop={6}
        >
          <MaterialIcons name="person" size={22} color="#2563EB" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <View>
              <Text style={styles.sectionTitle}>Menu Utama</Text>
              <Text style={styles.sectionSubtitle}>
                {MENU.length} modul tersedia
              </Text>
            </View>
          </View>

          <View style={styles.grid}>
            {visibleItems.map((item) => (
              <MenuTile
                key={item.key}
                item={item}
                onPress={() => onMenuPress(item)}
              />
            ))}
            {showToggle && (
              <ToggleTile
                mode={expanded ? "less" : "more"}
                onPress={() => setExpanded((v) => !v)}
              />
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Pengumuman</Text>
            <TouchableOpacity hitSlop={8} onPress={() => {}}>
              <Text style={styles.sectionLink}>Lihat semua</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.updateCard}>
            <View style={styles.updateThumb}>
              <MaterialIcons name="campaign" size={26} color="#2563EB" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.updateTitle}>{ANNOUNCEMENT.title}</Text>
              <Text style={styles.updateBody}>{ANNOUNCEMENT.body}</Text>
              <View style={styles.updateBadge}>
                <Text style={styles.updateBadgeText}>
                  {ANNOUNCEMENT.badge}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const TILE_LAYOUT = LinearTransition.duration(180);
const TILE_ENTER = FadeIn.duration(140);
const TILE_EXIT = FadeOut.duration(120);

function MenuTile({ item, onPress }: { item: MenuItem; onPress: () => void }) {
  const tint = item.accent + "1A";
  return (
    <Animated.View
      style={styles.tileSlot}
      layout={TILE_LAYOUT}
      entering={TILE_ENTER}
      exiting={TILE_EXIT}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        <View style={[styles.accentStrip, { backgroundColor: item.accent }]} />
        <View style={styles.cardBody}>
          <View style={[styles.iconBubble, { backgroundColor: tint }]}>
            <MaterialIcons name={item.icon} size={24} color={item.accent} />
          </View>
          <Text style={styles.tileLabel} numberOfLines={2}>
            {item.label}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function ToggleTile({
  mode,
  onPress,
}: {
  mode: "more" | "less";
  onPress: () => void;
}) {
  return (
    <Animated.View
      style={styles.tileSlot}
      layout={TILE_LAYOUT}
      entering={TILE_ENTER}
      exiting={TILE_EXIT}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        <View style={[styles.accentStrip, styles.accentStripNeutral]} />
        <View style={styles.cardBody}>
          <View style={[styles.iconBubble, styles.iconBubbleNeutral]}>
            <MaterialIcons
              name={mode === "more" ? "expand-more" : "expand-less"}
              size={24}
              color="#64748B"
            />
          </View>
          <Text style={styles.tileLabel} numberOfLines={2}>
            {mode === "more" ? "Lainnya" : "Tutup"}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F3F4F6" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: "#FAF8FF",
    gap: 12,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  headerCopy: { flex: 1 },
  welcomeText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  welcomeSub: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 2,
  },
  profileBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EEEFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20 },

  section: { marginBottom: 28 },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0F172A",
  },
  sectionSubtitle: {
    fontSize: 11,
    fontWeight: "500",
    color: "#94A3B8",
    marginTop: 2,
  },
  sectionLink: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2563EB",
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  tileSlot: {
    width: "25%",
    paddingHorizontal: 4,
    paddingBottom: 12,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardPressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
  accentStrip: {
    height: 3,
    width: "100%",
  },
  accentStripNeutral: {
    backgroundColor: "#E5E7EB",
  },
  cardBody: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 6,
    gap: 8,
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBubbleNeutral: {
    backgroundColor: "#F1F5F9",
  },
  tileLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: -0.1,
    color: "#0F172A",
    textAlign: "center",
    lineHeight: 14,
    height: 28,
  },

  updateCard: {
    flexDirection: "row",
    gap: 14,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  updateThumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: "#EDEDF9",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  updateTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0F172A",
  },
  updateBody: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
    marginTop: 4,
  },
  updateBadge: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: "rgba(0, 107, 95, 0.12)",
  },
  updateBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#006B5F",
    letterSpacing: 0.4,
  },
});
