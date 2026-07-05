import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  isFutureMonthKey,
  monthLabel,
  nextMonthKey,
  prevMonthKey,
  todayIso,
} from '../domain/dates';

interface Props {
  monthKey: string;
  onChange: (monthKey: string) => void;
}

export function MonthSelector({ monthKey, onChange }: Props) {
  const next = nextMonthKey(monthKey);
  const nextBlocked = isFutureMonthKey(next, todayIso());
  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => onChange(prevMonthKey(monthKey))}
        hitSlop={12}
        accessibilityLabel="Previous month"
      >
        <Ionicons name="chevron-back" size={22} color="#2563eb" />
      </Pressable>
      <Text style={styles.label}>{monthLabel(monthKey)}</Text>
      <Pressable
        onPress={() => onChange(next)}
        disabled={nextBlocked}
        hitSlop={12}
        accessibilityLabel="Next month"
      >
        <Ionicons
          name="chevron-forward"
          size={22}
          color={nextBlocked ? '#c7c9cd' : '#2563eb'}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 8,
  },
  label: {
    fontSize: 17,
    fontWeight: '600',
    minWidth: 150,
    textAlign: 'center',
  },
});
