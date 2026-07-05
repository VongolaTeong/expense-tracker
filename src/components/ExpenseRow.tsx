import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatAmount } from '../domain/money';
import type { Expense } from '../domain/types';

interface Props {
  expense: Expense;
  categoryName: string;
  onPress?: () => void;
}

/**
 * Primary text is the note, or the category name when the note is empty;
 * the category shows as secondary text only when a note exists (no
 * repetition). Amount is right-aligned. Tapping opens the row for edit.
 */
export function ExpenseRow({ expense, categoryName, onPress }: Props) {
  const hasNote = expense.note !== '';
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      android_ripple={{ color: '#e5e7eb' }}
      style={({ pressed }) => [styles.row, pressed && onPress ? styles.rowPressed : null]}
    >
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
    </Pressable>
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
  rowPressed: {
    backgroundColor: '#f9fafb',
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
