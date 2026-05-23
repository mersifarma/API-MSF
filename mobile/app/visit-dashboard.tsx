import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { VisitMenuFab } from '@/components/visit-menu-fab';
import {
  getCallFrequency,
  getCallProductivity,
  getCallReach,
} from '@/src/services/report.service';
import type {
  CallFrequencyReport,
  CallProductivityReport,
  CallReachReport,
  DoctorClass,
  FrequencyItem,
  Period,
} from '@/src/types/report';

const BULAN_ID = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

const BULAN_ID_FULL = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function formatPeriodID(p: Period): string {
  return `${BULAN_ID_FULL[p.month - 1]} ${p.year}`;
}

function currentPeriod(): Period {
  const d = new Date();
  return { month: d.getMonth() + 1, year: d.getFullYear() };
}

function progressColor(pct: number, threshold: number): string {
  if (pct >= threshold) return '#22C55E';
  if (pct >= threshold * 0.75) return '#F59E0B';
  return '#EF4444';
}

const CLASS_STYLE: Record<DoctorClass, { bg: string; text: string; border: string }> = {
  AA: { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' },
  AB: { bg: '#FEF3C7', text: '#B45309', border: '#FDE68A' },
  AC: { bg: '#FEF9E7', text: '#B45309', border: '#FEF3C7' },
  BA: { bg: '#DBEAFE', text: '#1E40AF', border: '#60A5FA' },
  BB: { bg: '#E0E7FF', text: '#3730A3', border: '#C7D2FE' },
  BC: { bg: '#EEF2FF', text: '#4338CA', border: '#E0E7FF' },
  CA: { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' },
  CB: { bg: '#F8FAFC', text: '#64748B', border: '#E2E8F0' },
  CC: { bg: '#F8FAFC', text: '#94A3B8', border: '#F1F5F9' },
};

type ReportState = {
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  reach: CallReachReport | null;
  frequency: CallFrequencyReport | null;
  productivity: CallProductivityReport | null;
};

function useReportData(period: Period) {
  const [state, setState] = useState<ReportState>({
    loading: true,
    refreshing: false,
    error: null,
    reach: null,
    frequency: null,
    productivity: null,
  });

  const load = useCallback(
    async (isRefresh: boolean) => {
      setState((s) => ({
        ...s,
        loading: !isRefresh && !s.reach,
        refreshing: isRefresh || !!s.reach,
        error: null,
      }));
      try {
        const [reach, frequency, productivity] = await Promise.all([
          getCallReach(period),
          getCallFrequency(period),
          getCallProductivity(period),
        ]);
        setState({
          loading: false,
          refreshing: false,
          error: null,
          reach,
          frequency,
          productivity,
        });
      } catch (err) {
        setState((s) => ({
          ...s,
          loading: false,
          refreshing: false,
          error: err instanceof Error ? err.message : 'Gagal memuat laporan.',
        }));
      }
    },
    [period],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  return { ...state, reload: () => load(true) };
}

export default function VisitDashboardScreen() {
  const [period, setPeriod] = useState<Period>(currentPeriod);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { loading, refreshing, error, reach, frequency, productivity, reload } =
    useReportData(period);

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <PeriodPickerBar
          period={period}
          onPress={() => setPickerOpen(true)}
        />

        <View style={styles.thresholdBar}>
          <MaterialIcons name="info-outline" size={13} color="#64748B" />
          <Text style={styles.thresholdText}>
            Target: Reach ≥80% · Frequency ≥60% · Productivity ≥80%
          </Text>
        </View>

        {loading ? (
          <View style={styles.fullLoader}>
            <ActivityIndicator color="#2563EB" size="large" />
            <Text style={styles.fullLoaderText}>Memuat laporan…</Text>
          </View>
        ) : error ? (
          <ErrorCard message={error} onRetry={reload} />
        ) : (
          <>
            {refreshing && (
              <View style={styles.refreshBar}>
                <ActivityIndicator color="#2563EB" size="small" />
                <Text style={styles.refreshText}>Memperbarui…</Text>
              </View>
            )}
            {reach && (
              <KpiCard
                kind="reach"
                title="Call Reach"
                subtitle="Customer Already Visit"
                totalPct={reach.total_pct}
                threshold={reach.threshold}
                doctor={{
                  label: 'Doctor',
                  actual: reach.doctor.visited,
                  target: reach.doctor.target,
                }}
                nonDoctor={
                  reach.non_doctor.target > 0
                    ? {
                        label: 'Non-Doctor',
                        actual: reach.non_doctor.visited,
                        target: reach.non_doctor.target,
                      }
                    : null
                }
                footnote="Counted from customers with at least 1 actual visit"
              />
            )}
            {frequency && (
              <KpiCard
                kind="frequency"
                title="Call Frequency"
                subtitle="Total Point Achieved"
                totalPct={frequency.total_pct}
                threshold={frequency.threshold}
                doctor={{
                  label: 'Doctor',
                  actual: frequency.doctor_breakdown.actual_sum,
                  target: frequency.doctor_breakdown.target_sum,
                }}
                nonDoctor={
                  frequency.non_doctor_breakdown.target_sum > 0
                    ? {
                        label: 'Non-Doctor',
                        actual: frequency.non_doctor_breakdown.actual_sum,
                        target: frequency.non_doctor_breakdown.target_sum,
                      }
                    : null
                }
                footnote="1 point earned when actual visit ≥ target visit"
              />
            )}
            {productivity && (
              <KpiCard
                kind="productivity"
                title="Call Productivity"
                subtitle="Total Actual Visits"
                totalPct={productivity.total_pct}
                threshold={productivity.threshold}
                doctor={{
                  label: 'Total Visits Dokter',
                  actual: productivity.doctor.actual,
                  target: productivity.doctor.target,
                }}
                nonDoctor={{
                  label: 'Total Visits Non-Dokter',
                  actual: productivity.non_doctor.actual,
                  target: productivity.non_doctor.target,
                }}
                badge={
                  productivity.non_target_visit_count > 0
                    ? `+${productivity.non_target_visit_count} Non-Target`
                    : null
                }
                footnote="Non-Target Visit hanya dihitung untuk Productivity"
              />
            )}

            {frequency && (
              <CustomerTableSection items={frequency.items} />
            )}
          </>
        )}
      </ScrollView>

      <VisitMenuFab />

      <PeriodPickerModal
        visible={pickerOpen}
        value={period}
        onClose={() => setPickerOpen(false)}
        onSelect={(p) => {
          setPeriod(p);
          setPickerOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

type KpiBreakdownRow = { label: string; actual: number; target: number };

function KpiCard({
  kind,
  title,
  subtitle,
  totalPct,
  threshold,
  doctor,
  nonDoctor,
  badge,
  footnote,
}: {
  kind: 'reach' | 'frequency' | 'productivity';
  title: string;
  subtitle: string;
  totalPct: number;
  threshold: number;
  doctor: KpiBreakdownRow;
  nonDoctor: KpiBreakdownRow | null;
  badge?: string | null;
  footnote?: string;
}) {
  const color = progressColor(totalPct, threshold);
  const accent = kind === 'productivity' ? '#F59E0B' : '#2563EB';
  const fillPct = Math.min(100, Math.max(0, totalPct));

  return (
    <View style={styles.kpiCard}>
      <View style={[styles.kpiStrip, { backgroundColor: accent }]} />
      <View style={styles.kpiHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kpiTitle}>{title}</Text>
          <Text style={styles.kpiSubtitle}>{subtitle}</Text>
        </View>
        {badge && (
          <View style={styles.kpiBadge}>
            <Text style={styles.kpiBadgeText}>{badge}</Text>
          </View>
        )}
      </View>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${fillPct}%`, backgroundColor: color },
          ]}
        />
        <Text style={styles.progressLabel}>{totalPct}%</Text>
      </View>

      <View style={styles.kpiBreakdown}>
        <BreakdownRow icon="person" row={doctor} />
        {nonDoctor && <BreakdownRow icon="storefront" row={nonDoctor} />}
      </View>

      {footnote && (
        <View style={styles.footnoteWrap}>
          <Text style={styles.footnoteText}>{footnote}</Text>
        </View>
      )}
    </View>
  );
}

function BreakdownRow({
  icon,
  row,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  row: KpiBreakdownRow;
}) {
  const tint = icon === 'person' ? '#2563EB' : '#22C55E';
  return (
    <View style={styles.bRow}>
      <MaterialIcons name={icon} size={18} color={tint} />
      <Text style={styles.bLabel}>{row.label}:</Text>
      <Text style={styles.bActual}>{row.actual}</Text>
      <Text style={styles.bTarget}> / {row.target}</Text>
    </View>
  );
}

function PeriodPickerBar({
  period,
  onPress,
}: {
  period: Period;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.periodBar}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <MaterialIcons name="event" size={18} color="#2563EB" />
      <Text style={styles.periodText}>{formatPeriodID(period)}</Text>
      <MaterialIcons name="keyboard-arrow-down" size={20} color="#64748B" />
    </TouchableOpacity>
  );
}

function PeriodPickerModal({
  visible,
  value,
  onClose,
  onSelect,
}: {
  visible: boolean;
  value: Period;
  onClose: () => void;
  onSelect: (p: Period) => void;
}) {
  const [tempYear, setTempYear] = useState(value.year);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  useEffect(() => {
    if (visible) setTempYear(value.year);
  }, [visible, value.year]);

  const canGoNext = tempYear < currentYear;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Pilih Periode</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <MaterialIcons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <View style={styles.yearNav}>
            <TouchableOpacity
              onPress={() => setTempYear((y) => y - 1)}
              style={styles.yearBtn}
              hitSlop={8}
            >
              <MaterialIcons name="chevron-left" size={22} color="#0F172A" />
            </TouchableOpacity>
            <Text style={styles.yearText}>{tempYear}</Text>
            <TouchableOpacity
              onPress={() => canGoNext && setTempYear((y) => y + 1)}
              style={[styles.yearBtn, !canGoNext && styles.yearBtnDisabled]}
              hitSlop={8}
              disabled={!canGoNext}
            >
              <MaterialIcons
                name="chevron-right"
                size={22}
                color={canGoNext ? '#0F172A' : '#CBD5E1'}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.monthGrid}>
            {BULAN_ID.map((name, idx) => {
              const monthNum = idx + 1;
              const disabled =
                tempYear > currentYear ||
                (tempYear === currentYear && monthNum > currentMonth);
              const selected =
                tempYear === value.year && monthNum === value.month;
              return (
                <TouchableOpacity
                  key={name}
                  style={[
                    styles.monthCell,
                    selected && styles.monthCellActive,
                    disabled && styles.monthCellDisabled,
                  ]}
                  onPress={() =>
                    !disabled && onSelect({ month: monthNum, year: tempYear })
                  }
                  disabled={disabled}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.monthLabel,
                      selected && styles.monthLabelActive,
                      disabled && styles.monthLabelDisabled,
                    ]}
                  >
                    {name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function CustomerTableSection({ items }: { items: FrequencyItem[] }) {
  return (
    <View style={styles.tableCard}>
      <View style={styles.tableHeader}>
        <Text style={[styles.thText, styles.colCustomer]}>Customer</Text>
        <Text style={[styles.thText, styles.colSegment]}>Segment</Text>
        <Text style={[styles.thText, styles.colClass]}>Class</Text>
        <Text style={[styles.thText, styles.colAT]}>A/T</Text>
        <Text style={[styles.thText, styles.colPoint]}>Point</Text>
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>
            Belum ada data kunjungan untuk periode ini
          </Text>
        </View>
      ) : (
        items.map((item) => <CustomerRow key={item.customer_id} item={item} />)
      )}
    </View>
  );
}

function CustomerRow({ item }: { item: FrequencyItem }) {
  const reached = item.actual >= item.target;
  const segTint = item.segment === 'Dokter' ? '#DBEAFE' : '#DCFCE7';
  const segText = item.segment === 'Dokter' ? '#1E40AF' : '#15803D';
  const classStyle = item.class ? CLASS_STYLE[item.class] : null;

  return (
    <Pressable style={styles.tableRow} onPress={() => {}}>
      <View style={styles.colCustomer}>
        <Text style={styles.customerName} numberOfLines={1} ellipsizeMode="tail">
          {item.customer_name}
        </Text>
      </View>
      <View style={styles.colSegment}>
        <View style={[styles.segBadge, { backgroundColor: segTint }]}>
          <Text style={[styles.segText, { color: segText }]} numberOfLines={1}>
            {item.segment === 'Dokter' ? 'Doctor' : 'Non-Doctor'}
          </Text>
        </View>
      </View>
      <View style={styles.colClass}>
        {classStyle ? (
          <View
            style={[
              styles.classBadge,
              { backgroundColor: classStyle.bg, borderColor: classStyle.border },
            ]}
          >
            <Text style={[styles.classText, { color: classStyle.text }]}>
              {item.class}
            </Text>
          </View>
        ) : (
          <Text style={styles.dashText}>—</Text>
        )}
      </View>
      <View style={styles.colAT}>
        <Text
          style={[
            styles.atText,
            { color: reached ? '#16A34A' : '#F59E0B' },
          ]}
        >
          {item.actual}
        </Text>
        <Text style={styles.atTarget}>/{item.target}</Text>
      </View>
      <View style={styles.colPoint}>
        <View
          style={[
            styles.pointDot,
            { backgroundColor: item.point === 1 ? '#16A34A' : '#E2E8F0' },
          ]}
        >
          <Text
            style={[
              styles.pointText,
              { color: item.point === 1 ? '#FFFFFF' : '#94A3B8' },
            ]}
          >
            {item.point}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function ErrorCard({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <View style={styles.errorCard}>
      <MaterialIcons name="error-outline" size={22} color="#DC2626" />
      <Text style={styles.errorText}>{message}</Text>
      <TouchableOpacity style={styles.errorBtn} onPress={onRetry}>
        <Text style={styles.errorBtnText}>Muat Ulang</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3F4F6' },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },

  periodBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 10,
    marginBottom: 12,
  },
  periodText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },

  thresholdBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
    marginBottom: 14,
  },
  thresholdText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },

  fullLoader: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 12,
  },
  fullLoaderText: { fontSize: 13, color: '#64748B', fontWeight: '500' },

  refreshBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    marginBottom: 12,
  },
  refreshText: { fontSize: 12, color: '#2563EB', fontWeight: '600' },

  kpiCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    paddingLeft: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  kpiStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  kpiHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  kpiTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  kpiSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  kpiBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  kpiBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E',
    letterSpacing: 0.2,
  },

  progressTrack: {
    height: 22,
    backgroundColor: '#F1F5F9',
    borderRadius: 999,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
  },
  progressLabel: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowRadius: 2,
  },

  kpiBreakdown: {
    marginTop: 14,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    gap: 8,
  },
  bRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bLabel: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
    flex: 1,
  },
  bActual: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  bTarget: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  },

  footnoteWrap: {
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  footnoteText: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
  },

  tableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginTop: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1E3A8A',
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  thText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    minHeight: 52,
  },
  colCustomer: { flex: 2.2, paddingRight: 6 },
  colSegment: { flex: 1.2, paddingRight: 4 },
  colClass: { width: 42, alignItems: 'center' },
  colAT: { width: 46, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' },
  colPoint: { width: 36, alignItems: 'center' },

  customerName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  segBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  segText: {
    fontSize: 10,
    fontWeight: '600',
  },
  classBadge: {
    width: 32,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  classText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  dashText: { fontSize: 13, color: '#CBD5E1' },
  atText: { fontSize: 14, fontWeight: '700' },
  atTarget: { fontSize: 11, color: '#94A3B8' },
  pointDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointText: { fontSize: 12, fontWeight: '700' },

  emptyWrap: { paddingVertical: 24, alignItems: 'center' },
  emptyText: { fontSize: 12, color: '#94A3B8' },

  errorCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#991B1B',
    fontWeight: '500',
  },
  errorBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#DC2626',
    borderRadius: 8,
  },
  errorBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 360,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  yearNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    marginBottom: 12,
  },
  yearBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearBtnDisabled: { backgroundColor: '#F8FAFC' },
  yearText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    minWidth: 64,
    textAlign: 'center',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  monthCell: {
    width: '25%',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthCellActive: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
  },
  monthCellDisabled: { opacity: 0.4 },
  monthLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  monthLabelActive: { color: '#FFFFFF' },
  monthLabelDisabled: { color: '#CBD5E1' },
});
