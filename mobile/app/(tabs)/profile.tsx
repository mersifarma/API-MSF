import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { APP_VERSION } from '@/src/config/env';
import { LAST_LOGIN_KEY, useAuth } from '@/src/store/auth-context';

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

function formatLastLogin(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const day = String(d.getDate()).padStart(2, '0');
  const month = MONTHS_SHORT[d.getMonth()];
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year}, ${hh}:${mm}`;
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || '?';
}

export default function ProfileScreen() {
  const { user, pegawai, signOut } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [lastLogin, setLastLogin] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const read = async () => {
      try {
        const value =
          Platform.OS === 'web'
            ? typeof localStorage !== 'undefined'
              ? localStorage.getItem(LAST_LOGIN_KEY)
              : null
            : await SecureStore.getItemAsync(LAST_LOGIN_KEY);
        if (!cancelled) setLastLogin(value);
      } catch {
        if (!cancelled) setLastLogin(null);
      }
    };
    void read();
    return () => {
      cancelled = true;
    };
  }, []);

  const confirmSignOut = () => {
    Alert.alert('Sign Out', 'Apakah Anda yakin ingin keluar?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          void doSignOut();
        },
      },
    ]);
  };

  const doSignOut = async () => {
    setLoggingOut(true);
    try {
      await signOut();
    } finally {
      setLoggingOut(false);
    }
  };

  const displayName = (pegawai?.nama_peg || user?.name || user?.username || 'User').toUpperCase();
  const jabatan = pegawai?.jabatan ?? '';
  const divisi = pegawai?.divisi ?? '';
  const roleBadge = [jabatan, divisi].filter(Boolean).join(' - ');
  const lastLoginText = formatLastLogin(lastLogin);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Profile</Text>

        <View style={styles.heroCard}>
          <View style={styles.avatarRing}>
            <View style={styles.avatarInner}>
              <Text style={styles.avatarText}>{getInitials(pegawai?.nama_peg ?? user?.name)}</Text>
            </View>
          </View>
          <Text style={styles.heroName} numberOfLines={2}>
            {displayName}
          </Text>
          {roleBadge.length > 0 && (
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{roleBadge}</Text>
            </View>
          )}
          {user?.email ? <Text style={styles.heroEmail}>{user.email}</Text> : null}
        </View>

        {divisi.length > 0 && (
          <InfoCard
            icon="business"
            label="Divisi"
            value={divisi}
            color="#2563EB"
          />
        )}

        {jabatan.length > 0 && (
          <InfoCard
            icon="badge"
            label="Jabatan"
            value={jabatan}
            color="#10B981"
          />
        )}

        {user?.username ? (
          <InfoCard
            icon="alternate-email"
            label="Username"
            value={user.username}
            color="#0EA5E9"
          />
        ) : null}

        {lastLoginText ? (
          <InfoCard
            icon="login"
            label="Login Terakhir"
            value={lastLoginText}
            color="#F59E0B"
          />
        ) : null}

        <TouchableOpacity
          style={[styles.signOut, loggingOut && styles.signOutDisabled]}
          onPress={confirmSignOut}
          disabled={loggingOut}
          activeOpacity={0.85}>
          {loggingOut ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialIcons name="logout" size={20} color="#fff" />
              <Text style={styles.signOutText}>Sign Out</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.version}>Version - {APP_VERSION} - APP DEV</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={styles.infoCard}>
      <View style={[styles.infoIconWrap, { backgroundColor: `${color}1A` }]}>
        <MaterialIcons name={icon} size={22} color={color} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} numberOfLines={2}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3F4F6' },
  container: { padding: 20, paddingBottom: 32, gap: 12 },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.4,
    marginBottom: 8,
  },

  heroCard: {
    backgroundColor: '#2563EB',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#1D4ED8',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
    marginBottom: 12,
  },
  avatarRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  avatarInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  heroName: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  roleBadge: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  heroEmail: {
    marginTop: 10,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
  },

  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  infoIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },

  signOut: {
    marginTop: 16,
    backgroundColor: '#EF4444',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: '#EF4444',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  signOutDisabled: { opacity: 0.6 },
  signOutText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
    letterSpacing: 0.4,
  },

  version: {
    marginTop: 12,
    textAlign: 'center',
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
});
