import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type DropdownOption = { value: string; label: string };

type Props = {
  label: string;
  placeholder?: string;
  value: string | null;
  options: DropdownOption[];
  onChange: (value: string | null) => void;
  disabled?: boolean;
};

export function DropdownPicker({
  label,
  placeholder = 'Pilih...',
  value,
  options,
  onChange,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const selected = value ? options.find((o) => o.value === value) : null;

  return (
    <>
      <TouchableOpacity
        style={[styles.trigger, disabled && styles.triggerDisabled]}
        onPress={() => !disabled && setOpen(true)}
        activeOpacity={0.8}
        disabled={disabled}
      >
        <Text style={selected ? styles.triggerValue : styles.triggerPlaceholder}>
          {selected ? selected.label : placeholder}
        </Text>
        <MaterialIcons
          name="keyboard-arrow-down"
          size={20}
          color={disabled ? '#CBD5E1' : '#64748B'}
        />
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
              <Text style={styles.headerText}>{label}</Text>
              <TouchableOpacity
                onPress={() => setOpen(false)}
                style={styles.closeBtn}
                hitSlop={10}
              >
                <MaterialIcons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>
            <View style={styles.divider} />

            <FlatList
              data={[{ value: '', label: 'Semua' }, ...options]}
              keyExtractor={(item) => item.value || 'all'}
              style={styles.list}
              renderItem={({ item }) => {
                const isSelected = item.value === (value ?? '');
                return (
                  <TouchableOpacity
                    style={[styles.option, isSelected && styles.optionActive]}
                    onPress={() => {
                      onChange(item.value || null);
                      setOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        isSelected && styles.optionTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                    {isSelected && (
                      <MaterialIcons name="check" size={18} color="#2563EB" />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 44,
  },
  triggerDisabled: { opacity: 0.5 },
  triggerValue: { fontSize: 13, color: '#0F172A', fontWeight: '600', flex: 1 },
  triggerPlaceholder: { fontSize: 13, color: '#94A3B8', flex: 1 },

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
    maxHeight: '70%',
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  headerText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: { height: 1, backgroundColor: '#E2E8F0' },
  list: { flexGrow: 0 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  optionActive: { backgroundColor: '#EFF6FF' },
  optionText: { fontSize: 14, color: '#0F172A', flex: 1 },
  optionTextActive: { color: '#2563EB', fontWeight: '600' },
});
