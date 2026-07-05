import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DateSeparator } from '../components/DateSeparator';
import { EmptyState } from '../components/EmptyState';
import { ExpenseRow } from '../components/ExpenseRow';
import { MonthSelector } from '../components/MonthSelector';
import { listCategories } from '../db/categories';
import { getExpensesForMonth } from '../db/expenses';
import { subscribeDataChanged } from '../db/notifier';
import { monthKeyOf, todayIso } from '../domain/dates';
import { groupExpensesByDay } from '../domain/grouping';
import { formatAmount } from '../domain/money';
import type { Category, Expense } from '../domain/types';
import { AddExpenseModal } from './AddExpenseModal';
import { SettingsScreen } from './SettingsScreen';

interface DaySectionData {
  key: string;
  dayLabel: string;
  data: Expense[];
}

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [monthKey, setMonthKey] = useState(() => monthKeyOf(todayIso()));
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [exps, cats] = await Promise.all([
        getExpensesForMonth(monthKey),
        listCategories(),
      ]);
      setExpenses(exps);
      setCategories(cats);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [monthKey]);

  // Refetch on tab focus…
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  // …and immediately after any DB write (add modal, imports, etc.).
  useEffect(() => subscribeDataChanged(() => void load()), [load]);

  const nameById = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories]
  );

  const sections = useMemo<DaySectionData[]>(
    () =>
      groupExpensesByDay(expenses).map((s) => ({
        key: s.date,
        dayLabel: s.dayLabel,
        data: s.items,
      })),
    [expenses]
  );

  const totalCents = useMemo(
    () => expenses.reduce((sum, e) => sum + e.amountCents, 0),
    [expenses]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <MonthSelector monthKey={monthKey} onChange={setMonthKey} />
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatAmount(totalCents)}</Text>
        </View>
        <Pressable
          onPress={() => setSettingsOpen(true)}
          hitSlop={10}
          accessibilityLabel="Settings"
          style={styles.gearButton}
        >
          <Ionicons name="settings-outline" size={20} color="#6b7280" />
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {sections.length === 0 ? (
        <EmptyState title="No expenses this month" hint="Tap + to add one" />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ExpenseRow
              expense={item}
              categoryName={nameById.get(item.categoryId) ?? '?'}
              onPress={() => setEditing(item)}
            />
          )}
          renderSectionHeader={({ section }) => (
            <DateSeparator label={section.dayLabel} />
          )}
          contentContainerStyle={styles.listContent}
        />
      )}
      <AddExpenseModal
        visible={editing !== null}
        editing={editing ?? undefined}
        onClose={() => setEditing(null)}
      />
      <SettingsScreen visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
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
    paddingBottom: 8,
  },
  gearButton: {
    position: 'absolute',
    right: 16,
    top: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'baseline',
    gap: 8,
  },
  totalLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: '#111',
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
