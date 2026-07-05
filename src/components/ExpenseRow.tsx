import { StyleSheet, Text, View } from 'react-native';
import { formatAmount } from '../domain/money';
import type { Expense } from '../domain/types';

interface Props {
  expense: Expense;
  categoryName: string;
}

/**
 * Primary text is the note, or the category name when the note is empty;
 * the category shows as secondary text only when a note exists (no
 * repetition). Amount is right-aligned.
 */
export function ExpenseRow({ expense, categoryName }: Props) {
  const hasNote = expense.note !== '';
  return (
    <View style={styles.row}>
      <View style={styles.textColumn}>
        <Text style={styles.primary} numberOfLines={1}>
          {hasNote ? expense.note : categoryName}
        </Text>
        {hasNote ? (
          <Text style={styles.secondary} numberOfLines={1}>
            {categoryName}
          </Text>
        ) : null}
      </View>
      <Text style={styles.amount}>{formatAmount(expense.amountCents)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  textColumn: {
    flex: 1,
    marginRight: 12,
  },
  primary: {
    fontSize: 16,
    color: '#111',
  },
  secondary: {
    fontSize: 13,
    color: '#8a8d91',
    marginTop: 2,
  },
  amount: {
    fontSize: 16,
    fontVariant: ['tabular-nums'],
    color: '#111',
  },
});
