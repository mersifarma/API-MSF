import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Tier = 'GOLD A' | 'GOLD B' | 'SILVER A' | 'SILVER B' | 'BRONZE';
type Status = 'confirmed' | 'pending' | 'at-risk';

type PlannedDoctor = {
  id: string;
  name: string;
  specialty: string;
  hospital: string;
  tier: Tier;
  status: Status;
};

type SuggestedDoctor = {
  id: string;
  name: string;
  specialty: string;
  initials: string;
  accent: string;
};

const PLANNED: PlannedDoctor[] = [
  {
    id: 'd1',
    name: 'Dr. Ani Raharjo',
    specialty: 'Sp.JP - Jantung',
    hospital: 'RS Siloam',
    tier: 'GOLD A',
    status: 'confirmed',
  },
  {
    id: 'd2',
    name: 'Dr. Budi Santoso',
    specialty: 'Sp.PD - Penyakit Dalam',
    hospital: 'RS Mitra Keluarga',
    tier: 'SILVER B',
    status: 'pending',
  },
  {
    id: 'd3',
    name: 'Dr. Cahya Dewi',
    specialty: 'Sp.A - Anak',
    hospital: 'RS Hermina',
    tier: 'GOLD A',
    status: 'at-risk',
  },
  {
    id: 'd4',
    name: 'Dr. Dimas Pratama',
    specialty: 'Sp.OG - Kandungan',
    hospital: 'RS Pondok Indah',
    tier: 'GOLD B',
    status: 'confirmed',
  },
];

const SUGGESTED: SuggestedDoctor[] = [
  {
    id: 's1',
    name: 'Dr. Eka Putri',
    specialty: 'Sp.KK - Kulit & Kelamin',
    initials: 'EP',
    accent: '#6366F1',
  },
  {
    id: 's2',
    name: 'Dr. Fajar Nugraha',
    specialty: 'Sp.M - Mata',
    initials: 'FN',
    accent: '#0D9488',
  },
  {
    id: 's3',
    name: 'Dr. Gita Lestari',
    specialty: 'Sp.THT-KL',
    initials: 'GL',
    accent: '#D97706',
  },
];

const FILTERS = ['Semua Filter', 'Spesialis', 'Rumah Sakit', 'Wilayah'];

const STATUS_COLOR: Record<Status, string> = {
  confirmed: '#22C55E',
  pending: '#FACC15',
  'at-risk': '#EF4444',
};

const TIER_STYLE: Record<Tier, { bg: string; text: string; border: string }> = {
  'GOLD A': { bg: '#FEF3C7', text: '#B45309', border: '#FDE68A' },
  'GOLD B': { bg: '#FEF3C7', text: '#B45309', border: '#FDE68A' },
  'SILVER A': { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' },
  'SILVER B': { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' },
  BRONZE: { bg: '#FFEDD5', text: '#9A3412', border: '#FED7AA' },
};

const TARGET = 60;

export default function VisitPlanScreen() {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('Semua Filter');
  const [plan, setPlan] = useState<PlannedDoctor[]>(PLANNED);

  const remaining = Math.max(0, TARGET - plan.length);
  const achievedPct = Math.min(100, Math.round((plan.length / TARGET) * 100));

  const filteredSuggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SUGGESTED;
    return SUGGESTED.filter(
      (s) =>
        s.name.toLowerCase().includes(q) || s.specialty.toLowerCase().includes(q)
    );
  }, [query]);

  const onRemove = (id: string) => setPlan((p) => p.filter((d) => d.id !== id));

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.appbar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={12}>
          <MaterialIcons name="arrow-back-ios-new" size={20} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.appbarTitle}>Monthly Visit Planning</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Rencana Februari 2024</Text>
          <View style={styles.heroMetaRow}>
            <Text style={styles.heroMeta}>Target: {TARGET} Kunjungan</Text>
            <Text style={styles.heroMetaWarn}>Tersisa: {remaining} slot</Text>
          </View>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>PENCAPAIAN</Text>
            <Text style={styles.progressValue}>
              {plan.length}
              <Text style={styles.progressValueMuted}>/{TARGET}</Text>
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${achievedPct}%` }]} />
          </View>
        </View>

        <View style={styles.segmentedWrap}>
          <View style={styles.segmented}>
            <View style={styles.segmentActive}>
              <Text style={styles.segmentActiveText}>
                Daftar Pilihan ({plan.length})
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.listSection}>
          {plan.map((d) => (
            <PlannedCard key={d.id} doctor={d} onRemove={() => onRemove(d.id)} />
          ))}
        </View>

        <View style={styles.addSection}>
          <Text style={styles.addHeading}>Tambah Dokter Lainnya</Text>
          <View style={styles.searchWrap}>
            <MaterialIcons
              name="search"
              size={18}
              color="#94A3B8"
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Cari dokter untuk ditambahkan..."
              placeholderTextColor="#94A3B8"
              value={query}
              onChangeText={setQuery}
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}>
            {FILTERS.map((f) => {
              const active = f === activeFilter;
              return (
                <TouchableOpacity
                  key={f}
                  onPress={() => setActiveFilter(f)}
                  style={[styles.chip, active && styles.chipActive]}
                  activeOpacity={0.8}>
                  {active && (
                    <MaterialIcons
                      name="filter-list"
                      size={14}
                      color="#2563EB"
                      style={{ marginRight: 4 }}
                    />
                  )}
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {f}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.addList}>
            {filteredSuggestions.length === 0 ? (
              <Text style={styles.emptyText}>Tidak ada hasil untuk "{query}"</Text>
            ) : (
              filteredSuggestions.map((s) => (
                <View key={s.id} style={styles.addRow}>
                  <View style={styles.addRowLeft}>
                    <View
                      style={[
                        styles.avatar,
                        { backgroundColor: `${s.accent}1A` },
                      ]}>
                      <Text style={[styles.avatarText, { color: s.accent }]}>
                        {s.initials}
                      </Text>
                    </View>
                    <View style={{ flexShrink: 1 }}>
                      <Text style={styles.addName}>{s.name}</Text>
                      <Text style={styles.addSpec}>{s.specialty}</Text>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.addBtn} activeOpacity={0.8}>
                    <MaterialIcons name="add" size={14} color="#2563EB" />
                    <Text style={styles.addBtnText}>Tambah</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.ctaWrap}>
        <View style={styles.draftRow}>
          <View style={styles.draftDot} />
          <Text style={styles.draftText}>Draft Tersimpan</Text>
        </View>
        <TouchableOpacity style={styles.submitBtn} activeOpacity={0.9}>
          <Text style={styles.submitText}>Ajukan Approval</Text>
          <View style={styles.submitBadge}>
            <Text style={styles.submitBadgeText}>
              {plan.length}/{TARGET}
            </Text>
          </View>
        </TouchableOpacity>
      </SafeAreaView>
    </SafeAreaView>
  );
}

function PlannedCard({
  doctor,
  onRemove,
}: {
  doctor: PlannedDoctor;
  onRemove: () => void;
}) {
  const tier = TIER_STYLE[doctor.tier];
  const stripColor = STATUS_COLOR[doctor.status];

  return (
    <View style={styles.card}>
      <View style={[styles.cardStrip, { backgroundColor: stripColor }]} />
      <View style={styles.cardIcon}>
        <MaterialIcons name="check-circle" size={22} color="#16A34A" />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTopRow}>
          <View style={{ flexShrink: 1, paddingRight: 8 }}>
            <Text style={styles.cardName} numberOfLines={1}>
              {doctor.name}
            </Text>
            <Text style={styles.cardSpec} numberOfLines={1}>
              {doctor.specialty}
            </Text>
          </View>
          <View
            style={[
              styles.tierBadge,
              { backgroundColor: tier.bg, borderColor: tier.border },
            ]}>
            <Text style={[styles.tierText, { color: tier.text }]}>
              {doctor.tier}
            </Text>
          </View>
        </View>
        <View style={styles.cardLocRow}>
          <MaterialIcons name="location-on" size={13} color="#64748B" />
          <Text style={styles.cardLocText}>{doctor.hospital}</Text>
        </View>
      </View>
      <View style={styles.cardActions}>
        <View style={styles.dragHandle}>
          <MaterialIcons name="drag-indicator" size={18} color="#94A3B8" />
        </View>
        <Pressable onPress={onRemove} hitSlop={8}>
          <MaterialIcons name="delete-outline" size={18} color="#CBD5E1" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3F4F6' },
  appbar: {
    height: 56,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(243, 244, 246, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appbarTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    letterSpacing: -0.2,
  },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 140 },

  hero: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  heroMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  heroMeta: { fontSize: 13, color: '#64748B' },
  heroMetaWarn: { fontSize: 13, color: '#EA580C', fontWeight: '500' },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0D9488',
    letterSpacing: 1.2,
  },
  progressValue: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  progressValueMuted: { fontSize: 13, fontWeight: '400', color: '#94A3B8' },
  progressTrack: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: { height: 8, backgroundColor: '#0D9488', borderRadius: 999 },

  segmentedWrap: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  segmented: {
    flexDirection: 'row',
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    padding: 4,
  },
  segmentActive: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentActiveText: { color: '#2563EB', fontWeight: '600', fontSize: 13 },

  listSection: { paddingHorizontal: 16, paddingTop: 4, gap: 10 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 12,
    paddingRight: 8,
    paddingLeft: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
  },
  cardIcon: { marginRight: 10 },
  cardBody: { flex: 1, minWidth: 0 },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  cardSpec: { fontSize: 12, color: '#64748B', marginTop: 1 },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  tierText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  cardLocRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardLocText: { fontSize: 12, color: '#64748B' },
  cardActions: {
    paddingLeft: 10,
    marginLeft: 6,
    borderLeftWidth: 1,
    borderLeftColor: '#F1F5F9',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  dragHandle: {},

  addSection: {
    marginTop: 16,
    paddingTop: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  addHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  searchWrap: {
    marginHorizontal: 16,
    position: 'relative',
  },
  searchIcon: { position: 'absolute', left: 12, top: 11, zIndex: 1 },
  searchInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingLeft: 36,
    paddingRight: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 14,
    color: '#0F172A',
  },
  chipsRow: { paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    borderColor: 'rgba(37, 99, 235, 0.2)',
  },
  chipText: { fontSize: 12, color: '#475569', fontWeight: '500' },
  chipTextActive: { color: '#2563EB', fontWeight: '600' },

  addList: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16, gap: 8 },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  addRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  addName: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  addSpec: { fontSize: 11, color: '#64748B', marginTop: 1 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    borderRadius: 8,
  },
  addBtnText: { fontSize: 12, fontWeight: '700', color: '#2563EB' },
  emptyText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    paddingVertical: 16,
  },

  ctaWrap: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 10,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  draftRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  draftDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22C55E' },
  draftText: { fontSize: 11, color: '#64748B', fontWeight: '500' },
  submitBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#2563EB',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  submitBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  submitBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
});
