import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '../components/EmptyState';
import { PeriodSelector } from '../components/PeriodSelector';
import { getCategorySummary } from '../db/expenses';
import { subscribeDataChanged } from '../db/notifier';
import { categoryColor } from '../domain/colors';
import { monthOf, todayIso } from '../domain/dates';
import type { Period } from '../domain/dates';
import { formatAmount } from '../domain/money';
import type { CategorySummary } from '../domain/types';

export function ChartsScreen() {
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<Period>(() => monthOf(todayIso()));
  const [summary, setSummary] = useState<CategorySummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      // Repo returns totals sorted desc and omits zero-spend categories.
      setSummary(await getCategorySummary(period.start, period.end));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [period]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );
  useEffect(() => subscribeDataChanged(() => void load()), [load]);

  const totalCents = useMemo(
    () => summary.reduce((sum, row) => sum + row.totalCents, 0),
    [summary]
  );

  const pieData = useMemo(
    () =>
      summary.map((row) => ({
        value: row.totalCents,
        color: categoryColor(row.categoryId),
      })),
    [summary]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <PeriodSelector period={period} onChange={setPeriod} />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {summary.length === 0 ? (
        <EmptyState title="No expenses in this period" />
      ) : (
        <FlatList
          data={summary}
          keyExtractor={(item) => item.categoryId}
          ListHeaderComponent={
            <View style={styles.chartWrap}>
              <PieChart
                data={pieData}
                donut
                radius={110}
                innerRadius={70}
                centerLabelComponent={() => (
                  <View style={styles.centerLabel}>
                    <Text style={styles.centerTotal}>{formatAmount(totalCents)}</Text>
                    <Text style={styles.centerCaption}>total</Text>
                  </View>
                )}
              />
            </View>
          }
          renderItem={({ item }) => <LegendRow row={item} totalCents={totalCents} />}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

function LegendRow({ row, totalCents }: { row: CategorySummary; totalCents: number }) {
  const pct = totalCents > 0 ? Math.round((row.totalCents / totalCents) * 100) : 0;
  return (
    <View style={styles.legendRow}>
      <View style={[styles.dot, { backgroundColor: categoryColor(row.categoryId) }]} />
      <Text style={styles.legendName} numberOfLines={1}>
        {row.name}
      </Text>
      <Text style={styles.legendAmount}>{formatAmount(row.totalCents)}</Text>
      <Text style={styles.legendPct}>{pct < 1 ? '<1%' : `${pct}%`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 4,
  },
  chartWrap: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  centerLabel: {
    alignItems: 'center',
  },
  centerTotal: {
    fontSize: 20,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: '#111',
  },
  centerCaption: {
    fontSize: 12,
    color: '#6b7280',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 10,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendName: {
    flex: 1,
    fontSize: 15,
    color: '#111',
  },
  legendAmount: {
    fontSize: 15,
    fontVariant: ['tabular-nums'],
    color: '#111',
  },
  legendPct: {
    width: 48,
    textAlign: 'right',
    fontSize: 13,
    color: '#6b7280',
    fontVariant: ['tabular-nums'],
  },
  listContent: {
    paddingBottom: 24,
  },
  error: {
    color: '#b91c1c',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});
