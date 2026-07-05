import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { listCategories } from '../db/categories';
import { deleteExpense, insertExpense, updateExpense } from '../db/expenses';
import { subscribeDataChanged } from '../db/notifier';
import { dayLabel, todayIso } from '../domain/dates';
import { formatAmount, parseAmountInput } from '../domain/money';
import type { AmountParseError } from '../domain/money';
import type { Category, Expense } from '../domain/types';
import { CategoryManager } from './CategoryManager';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** When set, the modal opens in edit mode (details step, pre-filled). */
  editing?: Expense;
}

type Step = 'category' | 'details' | 'manage';

const AMOUNT_ERROR_TEXT: Record<AmountParseError, string | null> = {
  empty: null, // nothing typed yet — just keep save disabled
  invalid: 'Enter a valid amount',
  tooManyDecimals: 'Use at most 2 decimal places',
};

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function AddExpenseModal({ visible, onClose, editing }: Props) {
  const [step, setStep] = useState<Step>('category');
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [amountText, setAmountText] = useState('');
  const [spentOn, setSpentOn] = useState(todayIso());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // (Re)initialize whenever the modal opens.
  useEffect(() => {
    if (!visible) return;
    setError(null);
    setBusy(false);
    setShowDatePicker(false);
    if (editing) {
      setStep('details');
      setCategoryId(editing.categoryId);
      setNote(editing.note);
      setAmountText(formatAmount(editing.amountCents));
      setSpentOn(editing.spentOn);
    } else {
      setStep('category');
      setCategoryId(null);
      setNote('');
      setAmountText('');
      setSpentOn(todayIso());
    }
    listCategories()
      .then(setCategories)
      .catch((err: unknown) => setError(errorMessage(err)));
  }, [visible, editing]);

  // Keep the picker in sync with Category Manager changes while open.
  useEffect(() => {
    if (!visible) return;
    return subscribeDataChanged(() => {
      listCategories()
        .then(setCategories)
        .catch((err: unknown) => setError(errorMessage(err)));
    });
  }, [visible]);

  const parsed = parseAmountInput(amountText);
  const amountValid = parsed.ok && parsed.cents > 0;
  const amountErrorText = parsed.ok ? null : AMOUNT_ERROR_TEXT[parsed.error];
  // Requiring the id to resolve against the *current* list guards the edge
  // where the picked category was deleted from the manager mid-flow.
  const selectedCategory = categories.find((c) => c.id === categoryId);
  const canSave = amountValid && selectedCategory !== undefined && !busy;

  const save = async () => {
    if (!canSave || selectedCategory === undefined || !parsed.ok) return;
    setBusy(true);
    try {
      const input = {
        categoryId: selectedCategory.id,
        note: note.trim(),
        amountCents: parsed.cents,
        spentOn,
      };
      if (editing) {
        await updateExpense(editing.id, input);
      } else {
        await insertExpense(input);
      }
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    if (!editing) return;
    Alert.alert('Delete expense?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await deleteExpense(editing.id);
              onClose();
            } catch (err) {
              setError(errorMessage(err));
            }
          })();
        },
      },
    ]);
  };

  const onDatePicked = (event: DateTimePickerEvent, date?: Date) => {
    setShowDatePicker(false);
    if (event.type === 'set' && date) setSpentOn(todayIso(date));
  };

  const today = todayIso();
  const dateChipLabel =
    spentOn === today
      ? 'Today'
      : spentOn.slice(0, 4) === today.slice(0, 4)
        ? dayLabel(spentOn)
        : `${dayLabel(spentOn)} ${spentOn.slice(0, 4)}`;

  const datePickerValue = new Date(
    Number(spentOn.slice(0, 4)),
    Number(spentOn.slice(5, 7)) - 1,
    Number(spentOn.slice(8, 10))
  );

  const title =
    step === 'manage' ? 'Categories' : editing ? 'Edit Expense' : 'Add Expense';
  const requestClose = step === 'manage' ? () => setStep('category') : onClose;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={requestClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {step === 'manage' ? (
                <Pressable
                  onPress={() => setStep('category')}
                  hitSlop={12}
                  accessibilityLabel="Back to category picker"
                >
                  <Ionicons name="chevron-back" size={24} color="#2563eb" />
                </Pressable>
              ) : null}
              <Text style={styles.title}>{title}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
              <Ionicons name="close" size={24} color="#6b7280" />
            </Pressable>
          </View>
          {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

          {step === 'manage' ? (
            <CategoryManager />
          ) : step === 'category' ? (
            <FlatList
              data={categories}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setCategoryId(item.id);
                    setStep('details');
                  }}
                  android_ripple={{ color: '#e5e7eb' }}
                  style={({ pressed }) => [styles.categoryRow, pressed && styles.pressed]}
                >
                  <Text style={styles.categoryName}>{item.name}</Text>
                </Pressable>
              )}
              ListFooterComponent={
                <Pressable
                  style={({ pressed }) => [styles.categoryRow, pressed && styles.pressed]}
                  onPress={() => setStep('manage')}
                >
                  <Text style={styles.addEditEntry}>＋ Add / Edit</Text>
                </Pressable>
              }
            />
          ) : (
            <View style={styles.details}>
              <Pressable
                onPress={() => setStep('category')}
                style={({ pressed }) => [styles.categoryChip, pressed && styles.pressed]}
                accessibilityLabel="Change category"
              >
                <Text style={styles.categoryChipText}>
                  {selectedCategory?.name ?? 'Pick a category'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#6b7280" />
              </Pressable>

              <TextInput
                style={styles.input}
                placeholder="Note (optional)"
                placeholderTextColor="#9ca3af"
                value={note}
                onChangeText={setNote}
                returnKeyType="done"
              />

              <TextInput
                style={[styles.input, styles.amountInput]}
                placeholder="0.00"
                placeholderTextColor="#9ca3af"
                keyboardType="decimal-pad"
                value={amountText}
                onChangeText={setAmountText}
              />
              {amountErrorText ? (
                <Text style={styles.amountError}>{amountErrorText}</Text>
              ) : null}

              <Pressable
                onPress={() => setShowDatePicker(true)}
                style={({ pressed }) => [styles.dateChip, pressed && styles.pressed]}
                accessibilityLabel="Change date"
              >
                <Ionicons name="calendar-outline" size={16} color="#2563eb" />
                <Text style={styles.dateChipText}>{dateChipLabel}</Text>
              </Pressable>
              {showDatePicker ? (
                <DateTimePicker
                  value={datePickerValue}
                  mode="date"
                  maximumDate={new Date()}
                  onChange={onDatePicked}
                />
              ) : null}

              <Pressable
                onPress={() => void save()}
                disabled={!canSave}
                style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
              >
                <Text style={styles.saveButtonText}>{editing ? 'Save changes' : 'Save'}</Text>
              </Pressable>

              {editing ? (
                <Pressable onPress={confirmDelete} hitSlop={8} style={styles.deleteLink}>
                  <Text style={styles.deleteLinkText}>Delete expense</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '85%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  errorBanner: {
    color: '#b91c1c',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  categoryRow: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#f3f4f6',
  },
  categoryName: {
    fontSize: 16,
    color: '#111',
  },
  addEditEntry: {
    fontSize: 16,
    color: '#6b7280',
  },
  pressed: {
    backgroundColor: '#f9fafb',
  },
  details: {
    paddingHorizontal: 20,
    gap: 12,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  categoryChipText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111',
  },
  amountInput: {
    fontSize: 22,
    fontVariant: ['tabular-nums'],
  },
  amountError: {
    color: '#b91c1c',
    fontSize: 13,
    marginTop: -6,
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: '#eff6ff',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  dateChipText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  saveButtonDisabled: {
    backgroundColor: '#bfdbfe',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteLink: {
    alignSelf: 'center',
    padding: 6,
  },
  deleteLinkText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '500',
  },
});
