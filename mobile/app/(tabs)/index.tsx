import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { ApiError } from '@/src/config/api';
import { useAuth } from '@/src/store/auth-context';
import type { Pegawai } from '@/src/types/api';

type ScheduleStatus = 'pending' | 'done' | 'in-transit';

type ScheduleItem = {
  id: string;
  name: string;
  specialty: string;
  initials: string;
  accent: string;
  time: string;
  status: ScheduleStatus;
};

const MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const TARGET = 60;
const DONE = 45;

const SCHEDULE: ScheduleItem[] = [
  {
    id: 's1',
    name: 'Dr. Ani Raharjo',
    specialty: 'Spesialis Saraf',
    initials: 'AR',
    accent: '#0D9488',
    time: '09:00',
    status: 'pending',
  },
  {
    id: 's2',
    name: 'Dr. Budi Santoso',
    specialty: 'Dokter Umum',
    initials: 'BS',
    accent: '#22C55E',
    time: '11:30',
    status: 'done',
  },
  {
    id: 's3',
    name: 'Dr. Cahya Dewi',
    specialty: 'Spesialis Jantung',
    initials: 'CD',
    accent: '#2563EB',
    time: '14:00',
    status: 'in-transit',
  },
];

function getGreeting(hour: number): string {
  if (hour < 11) return 'Selamat Pagi';
  if (hour < 15) return 'Selamat Siang';
  if (hour < 18) return 'Selamat Sore';
  return 'Selamat Malam';
}

export default function HomeScreen() {
  const { user, pegawai, pegawaiList, switchPegawai } = useAuth();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const greeting = useMemo(() => getGreeting(new Date().getHours()), []);
  const periodLabel = useMemo(() => {
    const now = new Date();
    return `Periode: ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  }, []);

  const firstName = (user?.name ?? '').split(' ')[0] || user?.username || '-';
  const completedPct = Math.round((DONE / TARGET) * 100);

  const onPick = async (p: Pegawai) => {
    if (p.rowid === pegawai?.rowid) {
      setPickerOpen(false);
      return;
    }
    setSwitching(true);
    try {
      await switchPegawai(p.rowid);
      setPickerOpen(false);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Gagal ganti pegawai.';
      Alert.alert('Switch pegawai', msg);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>
              {greeting}, {firstName}
            </Text>
            <Text style={styles.subGreeting}>Semoga harimu menyenangkan</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.bellBtn}
              hitSlop={6}
              onPress={() => router.push('/portal-menu')}>
              <MaterialIcons name="apps" size={22} color="#0F172A" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.bellBtn}
              hitSlop={6}
              onPress={() => router.push('/customer-list')}>
              <MaterialIcons name="people-outline" size={22} color="#0F172A" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.bellBtn} hitSlop={6}>
              <MaterialIcons name="notifications-none" size={22} color="#0F172A" />
              <View style={styles.bellDot} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.offlinePill}>
          <MaterialIcons name="wifi-off" size={14} color="#B45309" />
          <Text style={styles.offlineText}>Mode Offline Aktif</Text>
        </View>

        <TouchableOpacity
          style={styles.pegawaiRow}
          onPress={() => pegawaiList.length > 1 && setPickerOpen(true)}
          activeOpacity={pegawaiList.length > 1 ? 0.7 : 1}>
          <View style={styles.pegawaiAvatar}>
            <Text style={styles.pegawaiInitials}>
              {(pegawai?.nama_peg ?? user?.username ?? '?')
                .split(' ')
                .map((w) => w[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.pegawaiName}>{pegawai?.nama_peg ?? '-'}</Text>
            <Text style={styles.pegawaiMeta}>
              {pegawai?.jabatan ?? '-'}
              {pegawai?.divisi ? ` • ${pegawai.divisi}` : ''}
            </Text>
          </View>
          {pegawaiList.length > 1 && (
            <View style={styles.switchChip}>
              <MaterialIcons name="swap-horiz" size={14} color="#2563EB" />
              <Text style={styles.switchChipText}>Ganti ({pegawaiList.length})</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.targetCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.targetHeading}>Target Bulan Ini</Text>
            <Text style={styles.targetPeriod}>{periodLabel}</Text>
            <View style={styles.targetValueRow}>
              <Text style={styles.targetValue}>{DONE}</Text>
              <Text style={styles.targetValueMuted}>/ {TARGET}</Text>
            </View>
            <Text style={styles.targetLabel}>Kunjungan Selesai</Text>
          </View>
          <ProgressRing percent={completedPct} />
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Jadwal Hari Ini</Text>
          <TouchableOpacity onPress={() => router.push('/visit-plan')}>
            <Text style={styles.sectionLink}>Lihat Semua</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.scheduleList}>
          {SCHEDULE.map((item) => (
            <ScheduleCard key={item.id} item={item} />
          ))}
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/visit-plan')}
        activeOpacity={0.85}>
        <MaterialIcons name="add" size={26} color="#fff" />
      </TouchableOpacity>

      <Modal visible={pickerOpen} animationType="slide" transparent>
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => !switching && setPickerOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Pilih pegawai</Text>
            {pegawaiList.map((p) => (
              <TouchableOpacity
                key={p.rowid}
                style={[
                  styles.pegItem,
                  p.rowid === pegawai?.rowid && styles.pegItemActive,
                ]}
                onPress={() => onPick(p)}
                disabled={switching}>
                <Text style={styles.pegName}>{p.nama_peg}</Text>
                <Text style={styles.pegMeta}>
                  {p.jabatan}
                  {p.divisi ? ` • ${p.divisi}` : ''}
                </Text>
              </TouchableOpacity>
            ))}
            {switching && (
              <View style={styles.modalLoading}>
                <ActivityIndicator />
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function ProgressRing({ percent }: { percent: number }) {
  const size = 96;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (circumference * percent) / 100;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#0D9488"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
        />
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={styles.ringText}>{percent}%</Text>
      </View>
    </View>
  );
}

function ScheduleCard({ item }: { item: ScheduleItem }) {
  const done = item.status === 'done';
  const inTransit = item.status === 'in-transit';

  return (
    <View style={[styles.scheduleCard, inTransit && styles.scheduleCardActive]}>
      {inTransit && <View style={styles.scheduleAccentBar} />}
      <View style={styles.scheduleAvatarWrap}>
        <View style={[styles.scheduleAvatar, { backgroundColor: `${item.accent}1A` }]}>
          <Text style={[styles.scheduleAvatarText, { color: item.accent }]}>
            {item.initials}
          </Text>
        </View>
        {done && (
          <View style={styles.checkOverlay}>
            <MaterialIcons name="check-circle" size={16} color="#22C55E" />
          </View>
        )}
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.scheduleTopRow}>
          <View style={{ flexShrink: 1 }}>
            <Text
              style={[styles.scheduleName, done && styles.scheduleNameDone]}
              numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.scheduleSpec} numberOfLines={1}>
              {item.specialty}
            </Text>
          </View>
          <View style={[styles.timeChip, inTransit && styles.timeChipActive]}>
            <MaterialIcons
              name="schedule"
              size={11}
              color={inTransit ? '#2563EB' : '#64748B'}
            />
            <Text style={[styles.timeChipText, inTransit && styles.timeChipTextActive]}>
              {item.time}
            </Text>
          </View>
        </View>

        {item.status === 'pending' && (
          <View style={styles.checkInRow}>
            <View style={styles.checkInBtn}>
              <Text style={styles.checkInBtnText}>Belum Check-in</Text>
            </View>
          </View>
        )}
        {done && (
          <View style={styles.doneRow}>
            <View style={styles.doneDot} />
            <Text style={styles.doneText}>Laporan terkirim</Text>
          </View>
        )}
        {inTransit && (
          <View style={styles.transitRow}>
            <View style={styles.transitPill}>
              <View style={styles.transitDot} />
              <Text style={styles.transitText}>Dalam Perjalanan</Text>
            </View>
            <TouchableOpacity style={styles.mapBtn} hitSlop={8}>
              <MaterialIcons name="map" size={16} color="#2563EB" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3F4F6' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  subGreeting: { fontSize: 13, color: '#64748B', marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellDot: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#F3F4F6',
  },

  offlinePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
    marginBottom: 16,
  },
  offlineText: { fontSize: 11, color: '#B45309', fontWeight: '600' },

  pegawaiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 16,
  },
  pegawaiAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pegawaiInitials: { fontSize: 13, fontWeight: '700', color: '#2563EB' },
  pegawaiName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  pegawaiMeta: { fontSize: 11, color: '#64748B', marginTop: 2 },
  switchChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
  },
  switchChipText: { fontSize: 11, fontWeight: '600', color: '#2563EB' },

  targetCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    marginBottom: 20,
    alignItems: 'center',
  },
  targetHeading: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  targetPeriod: { fontSize: 12, color: '#64748B', marginTop: 2, marginBottom: 14 },
  targetValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  targetValue: {
    fontSize: 30,
    fontWeight: '700',
    color: '#2563EB',
    letterSpacing: -0.6,
  },
  targetValueMuted: { fontSize: 16, color: '#94A3B8', fontWeight: '500' },
  targetLabel: { fontSize: 11, color: '#64748B', fontWeight: '500', marginTop: 2 },
  ringCenter: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringText: { fontSize: 13, fontWeight: '700', color: '#0D9488' },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  sectionLink: { fontSize: 12, fontWeight: '600', color: '#2563EB' },

  scheduleList: { gap: 10 },
  scheduleCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    overflow: 'hidden',
  },
  scheduleCardActive: {
    borderLeftWidth: 4,
    borderLeftColor: '#2563EB',
    paddingLeft: 11,
  },
  scheduleAccentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#2563EB',
  },
  scheduleAvatarWrap: { position: 'relative' },
  scheduleAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleAvatarText: { fontSize: 14, fontWeight: '700', letterSpacing: 0.3 },
  checkOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
  },

  scheduleTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  scheduleName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  scheduleNameDone: {
    textDecorationLine: 'line-through',
    textDecorationColor: '#94A3B8',
    color: '#475569',
  },
  scheduleSpec: { fontSize: 12, color: '#64748B', marginTop: 1 },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  timeChipActive: { backgroundColor: 'rgba(37, 99, 235, 0.1)' },
  timeChipText: { fontSize: 10, fontWeight: '600', color: '#64748B' },
  timeChipTextActive: { color: '#2563EB' },

  checkInRow: { marginTop: 10, alignItems: 'flex-end' },
  checkInBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  checkInBtnText: { fontSize: 11, fontWeight: '600', color: '#475569' },

  doneRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 5 },
  doneDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#22C55E' },
  doneText: { fontSize: 11, color: '#22C55E', fontWeight: '600' },

  transitRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  transitPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#2563EB',
  },
  transitDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#FFFFFF' },
  transitText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.3 },
  mapBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
  },
  modalTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12, color: '#0F172A' },
  pegItem: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  pegItemActive: { borderColor: '#2563EB', backgroundColor: 'rgba(37, 99, 235, 0.05)' },
  pegName: { fontWeight: '600', color: '#0F172A' },
  pegMeta: { fontSize: 12, color: '#64748B', marginTop: 2 },
  modalLoading: { padding: 12, alignItems: 'center' },
});
