import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type MenuItem = {
  key: string;
  label: string;
  subtitle: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  accent: string;
  kind: 'ready' | 'placeholder' | 'current';
  route?: string;
};

const MENU_ITEMS: MenuItem[] = [
  {
    key: 'customer-list',
    label: 'Customer List',
    subtitle: 'Master data seluruh customer aktif',
    icon: 'groups',
    accent: '#10B981',
    kind: 'ready',
    route: '/customer-list',
  },
  {
    key: 'call-list',
    label: 'Call List',
    subtitle: 'Daftar customer yang akan dikunjungi',
    icon: 'list-alt',
    accent: '#3B82F6',
    kind: 'placeholder',
    route: '/visit-coming-soon?feature=Call+List',
  },
  {
    key: 'call-plan',
    label: 'Call Plan',
    subtitle: 'Rencana kunjungan harian & mingguan',
    icon: 'event-note',
    accent: '#F59E0B',
    kind: 'placeholder',
    route: '/visit-coming-soon?feature=Call+Plan',
  },
  {
    key: 'call-actual',
    label: 'Call Actual',
    subtitle: 'Realisasi kunjungan & tambah kunjungan baru',
    icon: 'fact-check',
    accent: '#8B5CF6',
    kind: 'placeholder',
    route: '/visit-coming-soon?feature=Call+Actual',
  },
  {
    key: 'call-report',
    label: 'Call Report',
    subtitle: 'Rekap & laporan hasil kunjungan',
    icon: 'assessment',
    accent: '#EC4899',
    kind: 'current',
  },
  {
    key: 'offline-visit',
    label: 'Offline Visit',
    subtitle: 'Input kunjungan tanpa koneksi internet',
    icon: 'wifi-off',
    accent: '#64748B',
    kind: 'placeholder',
    route: '/visit-coming-soon?feature=Offline+Visit',
  },
  {
    key: 'join-visit',
    label: 'Join Visit',
    subtitle: 'Pendampingan & supervisi kunjungan bersama tim',
    icon: 'handshake',
    accent: '#0D9488',
    kind: 'placeholder',
    route: '/visit-coming-soon?feature=Join+Visit',
  },
];

export function VisitMenuFab() {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();

  const handleItemPress = (item: MenuItem) => {
    setOpen(false);
    if (item.kind === 'current' || !item.route) return;
    router.push(item.route as never);
  };

  return (
    <>
      <TouchableOpacity
        accessibilityLabel="Buka menu Visit"
        accessibilityRole="button"
        style={styles.fab}
        onPress={() => setOpen(true)}
        activeOpacity={0.85}
      >
        <MaterialIcons name="menu" size={26} color="#FFFFFF" />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.dragHandle} />

            <View style={styles.header}>
              <MaterialIcons name="menu" size={22} color="#1E3A8A" />
              <Text style={styles.headerText}>Menu Visit</Text>
              <TouchableOpacity
                onPress={() => setOpen(false)}
                style={styles.closeBtn}
                hitSlop={10}
                accessibilityLabel="Tutup menu"
              >
                <MaterialIcons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            >
              {MENU_ITEMS.map((item) => (
                <MenuRow
                  key={item.key}
                  item={item}
                  onPress={() => handleItemPress(item)}
                />
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function MenuRow({
  item,
  onPress,
}: {
  item: MenuItem;
  onPress: () => void;
}) {
  const isCurrent = item.kind === 'current';
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        isCurrent && styles.rowCurrent,
        pressed && styles.rowPressed,
      ]}
      onPress={onPress}
    >
      <View
        style={[styles.iconBubble, { backgroundColor: `${item.accent}1A` }]}
      >
        <MaterialIcons name={item.icon} size={22} color={item.accent} />
      </View>
      <View style={styles.rowText}>
        <View style={styles.rowTitleLine}>
          <Text style={styles.rowTitle}>{item.label}</Text>
          {isCurrent && (
            <View style={styles.currentBadge}>
              <Text style={styles.currentBadgeText}>Aktif</Text>
            </View>
          )}
        </View>
        <Text style={styles.rowSubtitle} numberOfLines={1}>
          {item.subtitle}
        </Text>
      </View>
      <MaterialIcons
        name="chevron-right"
        size={20}
        color={isCurrent ? '#CBD5E1' : '#94A3B8'}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1E40AF',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    maxHeight: '85%',
    shadowColor: '#0F172A',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 10,
  },
  headerText: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
    letterSpacing: -0.2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
  },

  list: { flexGrow: 0 },
  listContent: { paddingHorizontal: 12, paddingVertical: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 12,
  },
  rowCurrent: {
    backgroundColor: '#F8FAFC',
  },
  rowPressed: {
    backgroundColor: '#F1F5F9',
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, minWidth: 0 },
  rowTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  currentBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#DBEAFE',
  },
  currentBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#1E40AF',
    letterSpacing: 0.3,
  },
  rowSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
});
