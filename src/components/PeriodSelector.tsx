import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  isFuturePeriod,
  nextPeriod,
  periodContaining,
  periodLabel,
  prevPeriod,
  todayIso,
} from '../domain/dates';
import type { Period, PeriodType } from '../domain/dates';

interface Props {
  period: Period;
  onChange: (period: Period) => void;
}

const TYPES: { type: PeriodType; label: string }[] = [
  { type: 'week', label: 'Week' },
  { type: 'month', label: 'Month' },
  { type: 'year', label: 'Year' },
];

/** Week/Month/Year segmented control + prev/next pager, future blocked. */
export function PeriodSelector({ period, onChange }: Props) {
  const today = todayIso();
  const next = nextPeriod(period);
  const nextBlocked = isFuturePeriod(next, today);

  const switchType = (type: PeriodType) => {
    if (type === period.type) return;
    // Re-anchor on today when the current period contains it, otherwise on
    // the period's start, so switching types stays where the user is looking.
    const anchor = period.start <= today && today <= period.end ? today : period.start;
    onChange(periodContaining(type, anchor));
  };

  return (
    <View>
      <View style={styles.segmentRow}>
        {TYPES.map(({ type, label }) => (
          <Pressable
            key={type}
            onPress={() => switchType(type)}
            style={[styles.segment, period.type === type && styles.segmentActive]}
            accessibilityLabel={`Show by ${label.toLowerCase()}`}
          >
            <Text
              style={[styles.segmentText, period.type === type && styles.segmentTextActive]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.pagerRow}>
        <Pressable
          onPress={() => onChange(prevPeriod(period))}
          hitSlop={12}
          accessibilityLabel="Previous period"
        >
          <Ionicons name="chevron-back" size={22} color="#2563eb" />
        </Pressable>
        <Text style={styles.pagerLabel}>{periodLabel(period)}</Text>
        <Pressable
          onPress={() => onChange(next)}
          disabled={nextBlocked}
          hitSlop={12}
          accessibilityLabel="Next period"
        >
          <Ionicons
            name="chevron-forward"
            size={22}
            color={nextBlocked ? '#c7c9cd' : '#2563eb'}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  segmentRow: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    padding: 3,
    marginTop: 8,
  },
  segment: {
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderRadius: 8,
  },
  segmentActive: {
    backgroundColor: '#fff',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  segmentText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  segmentTextActive: {
    color: '#111',
    fontWeight: '600',
  },
  pagerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 8,
  },
  pagerLabel: {
    fontSize: 17,
    fontWeight: '600',
    minWidth: 190,
    textAlign: 'center',
  },
});
