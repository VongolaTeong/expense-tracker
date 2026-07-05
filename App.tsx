import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import { listCategories } from './src/db/categories';
import {
  deleteExpense,
  getCategorySummary,
  getExpensesForMonth,
  insertExpense,
} from './src/db/expenses';
import type { Category, CategorySummary, Expense } from './src/domain/types';

// ─────────────────────────────────────────────────────────────────────────────
// TEMPORARY Phase 1 smoke-test screen.
// Exercises the DB layer on-device: migration + seed, insert/delete,
// month query, category summary. Replaced by real navigation in Phase 4.
// ─────────────────────────────────────────────────────────────────────────────

function localTodayIso(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function debugFormatCents(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

export default function App() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<CategorySummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [inserted, setInserted] = useState(0);

  const month = localTodayIso().slice(0, 7);

  const refresh = useCallback(async () => {
    try {
      setCategories(await listCategories());
      setExpenses(await getExpensesForMonth(month));
      setSummary(await getCategorySummary(`${month}-01`, `${month}-31`));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [month]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onInsert = async () => {
    try {
      const cats = await listCategories();
      const cat = cats[inserted % cats.length];
      await insertExpense({
        categoryId: cat.id,
        // alternate note / no-note to exercise both row shapes
        note: inserted % 2 === 0 ? `sample #${inserted + 1}` : '',
        amountCents: 100 + Math.floor(Math.random() * 4900),
        spentOn: localTodayIso(),
      });
      setInserted((n) => n + 1);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const onDeleteNewest = async () => {
    try {
      if (expenses.length > 0) {
        await deleteExpense(expenses[0].id);
        await refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const categoryName = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? '?';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Phase 1 DB smoke test</Text>
      {error ? <Text style={styles.error}>Error: {error}</Text> : null}
      <Text style={styles.section}>
        Categories ({categories.length}): {categories.map((c) => c.name).join(', ')}
      </Text>
      <View style={styles.buttons}>
        <Button title="Insert sample expense" onPress={() => void onInsert()} />
        <Button title="Delete newest" onPress={() => void onDeleteNewest()} />
      </View>
      <Text style={styles.section}>This month ({month}) — {expenses.length} rows:</Text>
      <ScrollView style={styles.list}>
        {expenses.map((e) => (
          <Text key={e.id} style={styles.row}>
            {e.spentOn}  {e.note || `(${categoryName(e.categoryId)})`}  —{' '}
            {debugFormatCents(e.amountCents)}
          </Text>
        ))}
        <Text style={styles.section}>Summary:</Text>
        {summary.map((s) => (
          <Text key={s.categoryId} style={styles.row}>
            {s.name}: {debugFormatCents(s.totalCents)}
          </Text>
        ))}
      </ScrollView>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  section: {
    marginTop: 12,
    fontWeight: '500',
  },
  buttons: {
    marginTop: 12,
    gap: 8,
  },
  list: {
    flex: 1,
    marginTop: 4,
  },
  row: {
    fontVariant: ['tabular-nums'],
    paddingVertical: 2,
    color: '#333',
  },
  error: {
    color: '#c00',
    marginTop: 8,
  },
});
