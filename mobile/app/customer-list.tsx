import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DropdownPicker } from '@/components/dropdown-picker';
import { ApiError } from '@/src/config/api';
import {
  getCustomerSummary,
  getCustomers,
  getSpecialities,
  type Speciality,
} from '@/src/services/customer.service';
import { useAuth } from '@/src/store/auth-context';
import type { Customer, CustomerSummary } from '@/src/types/customer';

const PAGE_LIMIT = 50;

const CLASS_OPTIONS = [
  { value: 'AA', label: 'AA' },
  { value: 'AB', label: 'AB' },
  { value: 'AC', label: 'AC' },
  { value: 'BA', label: 'BA' },
  { value: 'BB', label: 'BB' },
  { value: 'BC', label: 'BC' },
  { value: 'CA', label: 'CA' },
  { value: 'CB', label: 'CB' },
  { value: 'CC', label: 'CC' },
];

const CLASS_STYLE: Record<string, { bg: string; text: string; border: string }> =
  {
    AA: { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' },
    AB: { bg: '#FEF3C7', text: '#B45309', border: '#FDE68A' },
    AC: { bg: '#FEF9E7', text: '#B45309', border: '#FEF3C7' },
    BA: { bg: '#DBEAFE', text: '#1E40AF', border: '#60A5FA' },
    BB: { bg: '#E0E7FF', text: '#3730A3', border: '#C7D2FE' },
    BC: { bg: '#DCFCE7', text: '#15803D', border: '#86EFAC' },
    CA: { bg: '#FEE2E2', text: '#991B1B', border: '#FCA5A5' },
    CB: { bg: '#FEF2F2', text: '#B91C1C', border: '#FECACA' },
    CC: { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' },
  };

function getCustomerName(c: Customer): string {
  return c.nama_dokter ?? c.nama_non_dokter ?? 'Tanpa Nama';
}

function formatHours(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  const trim = (s: string | null) =>
    s ? s.split(':').slice(0, 2).join(':') : '';
  const s = trim(start);
  const e = trim(end);
  if (s && e) return `${s} - ${e}`;
  return s || e || null;
}

type ListState = {
  items: Customer[];
  page: number;
  total: number;
  loading: boolean;
  loadingMore: boolean;
  refreshing: boolean;
  error: string | null;
};

const INITIAL_LIST: ListState = {
  items: [],
  page: 1,
  total: 0,
  loading: true,
  loadingMore: false,
  refreshing: false,
  error: null,
};

export default function CustomerListScreen() {
  const { token } = useAuth();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [spec, setSpec] = useState<string | null>(null);
  const [classFilter, setClassFilter] = useState<string | null>(null);
  const [list, setList] = useState<ListState>(INITIAL_LIST);
  const [summary, setSummary] = useState<CustomerSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [specialities, setSpecialities] = useState<Speciality[]>([]);
  const requestSeq = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchPage = useCallback(
    async (page: number, isRefresh: boolean) => {
      if (!token) return;
      const reqId = ++requestSeq.current;
      setList((s) => ({
        ...s,
        loading: page === 1 && !isRefresh && s.items.length === 0,
        refreshing: isRefresh && page === 1,
        loadingMore: page > 1,
        error: null,
      }));
      try {
        const res = await getCustomers(token, {
          search: debounced || undefined,
          spec: spec || undefined,
          class: classFilter || undefined,
          page,
          limit: PAGE_LIMIT,
        });
        if (reqId !== requestSeq.current) return;
        setList((s) => ({
          items: page === 1 ? res.data : [...s.items, ...res.data],
          page,
          total: res.meta.total,
          loading: false,
          refreshing: false,
          loadingMore: false,
          error: null,
        }));
      } catch (err) {
        if (reqId !== requestSeq.current) return;
        const msg =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
            ? err.message
            : 'Gagal memuat data customer.';
        setList((s) => ({
          ...s,
          loading: false,
          refreshing: false,
          loadingMore: false,
          error: msg,
        }));
      }
    },
    [token, debounced, spec, classFilter],
  );

  const fetchSummary = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getCustomerSummary(token);
      setSummary(data);
      setSummaryError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal memuat summary.';
      setSummaryError(msg);
    }
  }, [token]);

  const fetchSpecialities = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getSpecialities(token);
      setSpecialities(data);
    } catch {
      // silent fail — dropdown akan kosong, user tetap bisa search manual
    }
  }, [token]);

  useEffect(() => {
    void fetchPage(1, false);
  }, [fetchPage]);

  useEffect(() => {
    void fetchSummary();
    void fetchSpecialities();
  }, [fetchSummary, fetchSpecialities]);

  const onRefresh = useCallback(() => {
    void fetchSummary();
    void fetchPage(1, true);
  }, [fetchPage, fetchSummary]);

  const onEndReached = useCallback(() => {
    if (list.loading || list.loadingMore || list.refreshing) return;
    if (list.items.length >= list.total) return;
    void fetchPage(list.page + 1, false);
  }, [list, fetchPage]);

  const onRetry = useCallback(() => {
    void fetchPage(1, false);
    if (summaryError) void fetchSummary();
  }, [fetchPage, fetchSummary, summaryError]);

  const specOptions = useMemo(
    () =>
      specialities.map((s) => ({
        value: s.spec,
        label: s.spec,
      })),
    [specialities],
  );

  const ListHeader = useMemo(
    () => (
      <View style={styles.headerWrap}>
        <CustomerOverview summary={summary} error={summaryError} />
        <SearchCard value={search} onChangeText={setSearch} />
        <FilterCard
          spec={spec}
          onSpecChange={setSpec}
          classValue={classFilter}
          onClassChange={setClassFilter}
          specOptions={specOptions}
        />

        {list.error && (
          <View style={styles.errorCard}>
            <MaterialIcons name="error-outline" size={20} color="#DC2626" />
            <Text style={styles.errorText}>{list.error}</Text>
            <TouchableOpacity style={styles.errorBtn} onPress={onRetry}>
              <Text style={styles.errorBtnText}>Coba Lagi</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.listHeaderCard}>
          <View style={styles.listHeaderLeft}>
            <MaterialIcons name="list-alt" size={20} color="#2563EB" />
            <Text style={styles.listHeaderTitle}>Customer List</Text>
          </View>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{list.total} customers</Text>
          </View>
        </View>
      </View>
    ),
    [
      summary,
      summaryError,
      search,
      spec,
      classFilter,
      specOptions,
      list.error,
      list.total,
      onRetry,
    ],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      {list.loading && list.items.length === 0 ? (
        <View style={styles.fullLoader}>
          <ActivityIndicator color="#2563EB" size="large" />
          <Text style={styles.fullLoaderText}>Memuat customer…</Text>
        </View>
      ) : (
        <FlatList
          data={list.items}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <CustomerCard item={item} />}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={styles.listContent}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={list.refreshing}
              onRefresh={onRefresh}
              tintColor="#2563EB"
              colors={['#2563EB']}
            />
          }
          ListEmptyComponent={
            list.loading ? null : (
              <View style={styles.emptyWrap}>
                <MaterialIcons name="search-off" size={48} color="#CBD5E1" />
                <Text style={styles.emptyText}>
                  Tidak ada customer ditemukan
                </Text>
              </View>
            )
          }
          ListFooterComponent={
            list.loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator color="#2563EB" size="small" />
              </View>
            ) : list.items.length > 0 && list.items.length < list.total ? (
              <View style={styles.footerHint}>
                <Text style={styles.footerHintText}>
                  {list.items.length} dari {list.total}
                </Text>
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

function CustomerOverview({
  summary,
  error,
}: {
  summary: CustomerSummary | null;
  error: string | null;
}) {
  const stats: {
    key: string;
    label: string;
    value: number | string;
    icon: keyof typeof MaterialIcons.glyphMap;
    accent: string;
  }[] = [
    {
      key: 'total',
      label: 'Total',
      value: summary?.total ?? '—',
      icon: 'groups',
      accent: '#2563EB',
    },
    {
      key: 'doctor',
      label: 'Doctor',
      value: summary?.doctor ?? '—',
      icon: 'person',
      accent: '#1E40AF',
    },
    {
      key: 'non-doctor',
      label: 'Non Doctor',
      value: summary?.non_doctor ?? '—',
      icon: 'storefront',
      accent: '#15803D',
    },
    {
      key: 'spec',
      label: 'Specialities',
      value: summary?.specialities ?? '—',
      icon: 'category',
      accent: '#15803D',
    },
    {
      key: 'class-a',
      label: 'Class A',
      value: summary?.class_a ?? '—',
      icon: 'workspace-premium',
      accent: '#2563EB',
    },
    {
      key: 'class-b',
      label: 'Class B',
      value: summary?.class_b ?? '—',
      icon: 'workspace-premium',
      accent: '#15803D',
    },
    {
      key: 'class-c',
      label: 'Class C',
      value: summary?.class_c ?? '—',
      icon: 'workspace-premium',
      accent: '#DC2626',
    },
  ];

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <MaterialIcons name="people" size={20} color="#2563EB" />
        <Text style={styles.cardTitle}>Customer Overview</Text>
      </View>
      {error ? (
        <View style={styles.summaryError}>
          <Text style={styles.summaryErrorText}>{error}</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statsRow}
        >
          {stats.map((s) => (
            <View key={s.key} style={styles.statCell}>
              <View
                style={[styles.statIcon, { backgroundColor: `${s.accent}1A` }]}
              >
                <MaterialIcons name={s.icon} size={20} color={s.accent} />
              </View>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function SearchCard({
  value,
  onChangeText,
}: {
  value: string;
  onChangeText: (v: string) => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <MaterialIcons name="search" size={20} color="#2563EB" />
        <Text style={styles.cardTitle}>Search Doctor</Text>
      </View>
      <View style={styles.searchWrap}>
        <MaterialIcons
          name="search"
          size={18}
          color="#94A3B8"
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, outlet, or location..."
          placeholderTextColor="#94A3B8"
          value={value}
          onChangeText={onChangeText}
          returnKeyType="search"
          autoCorrect={false}
        />
        {value.length > 0 && (
          <Pressable
            onPress={() => onChangeText('')}
            hitSlop={8}
            style={styles.searchClear}
          >
            <MaterialIcons name="close" size={16} color="#94A3B8" />
          </Pressable>
        )}
      </View>
    </View>
  );
}

function FilterCard({
  spec,
  onSpecChange,
  classValue,
  onClassChange,
  specOptions,
}: {
  spec: string | null;
  onSpecChange: (v: string | null) => void;
  classValue: string | null;
  onClassChange: (v: string | null) => void;
  specOptions: { value: string; label: string }[];
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <MaterialIcons name="filter-list" size={20} color="#2563EB" />
        <Text style={styles.cardTitle}>Filter</Text>
      </View>
      <View style={styles.filterRow}>
        <DropdownPicker
          label="Speciality"
          placeholder="Speciality"
          value={spec}
          options={specOptions}
          onChange={onSpecChange}
        />
        <View style={{ width: 10 }} />
        <DropdownPicker
          label="Class"
          placeholder="Class"
          value={classValue}
          options={CLASS_OPTIONS}
          onChange={onClassChange}
        />
      </View>
    </View>
  );
}

function CustomerCard({ item }: { item: Customer }) {
  const name = getCustomerName(item).toUpperCase();
  const specLabel = item.spec?.toUpperCase() ?? null;
  const hours = formatHours(item.jam_mulai_praktek, item.jam_selesai_praktek);
  const classStyle = item.class ? CLASS_STYLE[item.class] : null;
  const avatarBg = item.segmen_md === 2 ? '#22C55E' : '#22C55E';

  return (
    <View style={styles.customerCard}>
      <View style={[styles.customerAvatar, { backgroundColor: avatarBg }]}>
        <MaterialIcons name="person" size={32} color="#FFFFFF" />
      </View>
      <View style={styles.customerBody}>
        <View style={styles.customerTopRow}>
          <Text style={styles.customerName} numberOfLines={2}>
            {name}
          </Text>
          {classStyle && item.class && (
            <View
              style={[
                styles.classBadge,
                {
                  backgroundColor: classStyle.bg,
                  borderColor: classStyle.border,
                },
              ]}
            >
              <Text style={[styles.classText, { color: classStyle.text }]}>
                {item.class}
              </Text>
            </View>
          )}
        </View>
        {specLabel && <Text style={styles.customerSpec}>{specLabel}</Text>}
        {item.institusi && (
          <View style={styles.metaRow}>
            <MaterialIcons name="business" size={14} color="#64748B" />
            <Text style={styles.metaText} numberOfLines={1}>
              {item.institusi}
            </Text>
          </View>
        )}
        {item.hari_praktek && (
          <View style={styles.metaRow}>
            <MaterialIcons name="event" size={14} color="#64748B" />
            <Text style={styles.metaText} numberOfLines={1}>
              {item.hari_praktek}
            </Text>
          </View>
        )}
        {hours && <Text style={styles.hoursText}>{hours}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3F4F6' },

  fullLoader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  fullLoaderText: { fontSize: 13, color: '#64748B', fontWeight: '500' },

  listContent: { paddingBottom: 24 },

  headerWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },

  statsRow: {
    gap: 10,
    paddingRight: 4,
  },
  statCell: {
    width: 100,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 4,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'center',
  },
  summaryError: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
  },
  summaryErrorText: { fontSize: 12, color: '#991B1B' },

  searchWrap: { position: 'relative' },
  searchIcon: { position: 'absolute', left: 12, top: 11, zIndex: 1 },
  searchInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingLeft: 36,
    paddingRight: 32,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 13,
    color: '#0F172A',
  },
  searchClear: {
    position: 'absolute',
    right: 10,
    top: 11,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  filterRow: { flexDirection: 'row' },

  errorCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  errorText: { flex: 1, fontSize: 12, color: '#991B1B', fontWeight: '500' },
  errorBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#DC2626',
    borderRadius: 8,
  },
  errorBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },

  listHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    marginBottom: 4,
  },
  listHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  listHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  countBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#2563EB',
  },
  countBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  customerCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  customerAvatar: {
    width: 60,
    height: 60,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#22C55E',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  customerBody: { flex: 1, minWidth: 0, gap: 4 },
  customerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 2,
  },
  customerName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.1,
    lineHeight: 18,
  },
  classBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  classText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  customerSpec: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    flex: 1,
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  hoursText: {
    fontSize: 11,
    color: '#94A3B8',
    fontStyle: 'italic',
    marginLeft: 20,
  },

  emptyWrap: {
    paddingVertical: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyText: { fontSize: 13, color: '#94A3B8', fontWeight: '500' },

  footerLoader: { paddingVertical: 16, alignItems: 'center' },
  footerHint: { paddingVertical: 12, alignItems: 'center' },
  footerHintText: { fontSize: 11, color: '#94A3B8' },
});
