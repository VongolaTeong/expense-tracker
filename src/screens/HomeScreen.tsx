import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DateSeparator } from '../components/DateSeparator';
import { EmptyState } from '../components/EmptyState';
import { ExpenseRow } from '../components/ExpenseRow';
import { MonthSelector } from '../components/MonthSelector';
import { listCategories } from '../db/categories';
import { getExpensesForMonth, insertExpense } from '../db/expenses';
import { monthBounds, monthKeyOf, todayIso } from '../domain/dates';
import { groupExpensesByDay } from '../domain/grouping';
import { formatAmount } from '../domain/money';
import type { Category, Expense } from '../domain/types';

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

  // Refetch whenever the tab regains focus (v1 refresh strategy).
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

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

  // TEMP (Phase 4 only): seeds a random expense into the selected month so
  // the list/refresh behavior can be exercised before the Add flow exists.
  // Removed in Phase 5.
  const insertSample = async () => {
    try {
      const cats = categories.length > 0 ? categories : await listCategories();
      const today = todayIso();
      const { end } = monthBounds(monthKey);
      const lastAllowed = end <= today ? end : today;
      const maxDay = Number(lastAllowed.slice(8, 10));
      const day = 1 + Math.floor(Math.random() * maxDay);
      const cat = cats[Math.floor(Math.random() * cats.length)];
      await insertExpense({
        categoryId: cat.id,
        note: Math.random() < 0.5 ? `sample ${Math.floor(Math.random() * 100)}` : '',
        amountCents: 100 + Math.floor(Math.random() * 4900),
        spentOn: `${monthKey}-${String(day).padStart(2, '0')}`,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <MonthSelector monthKey={monthKey} onChange={setMonthKey} />
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatAmount(totalCents)}</Text>
        </View>
        <Pressable onPress={() => void insertSample()} style={styles.tempButton}>
          <Text style={styles.tempButtonText}>＋ sample (temp)</Text>
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {sections.length === 0 ? (
        <EmptyState
          title="No expenses this month"
          hint="Tap + to add one (coming in Phase 5)"
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ExpenseRow
              expense={item}
              categoryName={nameById.get(item.categoryId) ?? '?'}
            />
          )}
          renderSectionHeader={({ section }) => (
            <DateSeparator label={section.dayLabel} />
          )}
          contentContainerStyle={styles.listContent}
        />
      )}
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
  tempButton: {
    alignSelf: 'center',
    marginTop: 6,
  },
  tempButtonText: {
    fontSize: 12,
    color: '#2563eb',
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
