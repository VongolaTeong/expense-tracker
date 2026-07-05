import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  addCategory,
  categoryHasExpenses,
  deleteCategory,
  listCategories,
  renameCategory,
  reorderCategories,
} from '../db/categories';
import type { Category } from '../domain/types';

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

interface IconButtonProps {
  name: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
  color?: string;
  label: string;
}

function IconButton({ name, onPress, disabled, color = '#2563eb', label }: IconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityLabel={label}
      style={styles.iconButton}
    >
      <Ionicons name={name} size={20} color={disabled ? '#d1d5db' : color} />
    </Pressable>
  );
}

/**
 * Category list with add / inline rename / up-down reorder / guarded delete.
 * Rendered as the "manage" step of the Add Expense modal.
 */
export function CategoryManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [inUse, setInUse] = useState<Record<string, boolean>>({});
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  const load = useCallback(async () => {
    const cats = await listCategories();
    const usage = await Promise.all(cats.map((c) => categoryHasExpenses(c.id)));
    setCategories(cats);
    setInUse(Object.fromEntries(cats.map((c, i) => [c.id, usage[i]])));
  }, []);

  useEffect(() => {
    load().catch((err: unknown) => Alert.alert('Error', errorMessage(err)));
  }, [load]);

  const submitNew = async () => {
    if (newName.trim() === '') return;
    try {
      await addCategory(newName);
      setNewName('');
      await load();
    } catch (err) {
      Alert.alert('Cannot add category', errorMessage(err));
    }
  };

  const startRename = (category: Category) => {
    setEditingId(category.id);
    setEditingText(category.name);
  };

  const commitRename = async () => {
    if (editingId === null) return;
    try {
      await renameCategory(editingId, editingText);
      setEditingId(null);
      await load();
    } catch (err) {
      Alert.alert('Cannot rename category', errorMessage(err));
    }
  };

  const move = async (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= categories.length) return;
    const next = [...categories];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    setCategories(next); // optimistic; repo write follows
    try {
      await reorderCategories(next.map((c) => c.id));
    } catch (err) {
      Alert.alert('Cannot reorder', errorMessage(err));
      await load();
    }
  };

  const confirmDelete = (category: Category) => {
    Alert.alert('Delete category?', `"${category.name}" will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await deleteCategory(category.id);
              await load();
            } catch (err) {
              Alert.alert('Cannot delete category', errorMessage(err));
            }
          })();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.addRow}>
        <TextInput
          style={styles.addInput}
          placeholder="New category name"
          placeholderTextColor="#9ca3af"
          value={newName}
          onChangeText={setNewName}
          onSubmitEditing={() => void submitNew()}
          returnKeyType="done"
        />
        <IconButton
          name="add-circle"
          onPress={() => void submitNew()}
          disabled={newName.trim() === ''}
          label="Add category"
        />
      </View>
      <Text style={styles.hint}>
        Tap a name to rename. Categories in use can’t be deleted.
      </Text>
      <FlatList
        data={categories}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        style={styles.list}
        renderItem={({ item, index }) => (
          <View style={styles.row}>
            {editingId === item.id ? (
              <>
                <TextInput
                  style={styles.renameInput}
                  value={editingText}
                  onChangeText={setEditingText}
                  autoFocus
                  onSubmitEditing={() => void commitRename()}
                  returnKeyType="done"
                />
                <IconButton
                  name="checkmark"
                  onPress={() => void commitRename()}
                  color="#16a34a"
                  label="Confirm rename"
                />
                <IconButton
                  name="close"
                  onPress={() => setEditingId(null)}
                  color="#6b7280"
                  label="Cancel rename"
                />
              </>
            ) : (
              <>
                <Pressable style={styles.nameArea} onPress={() => startRename(item)}>
                  <Text style={styles.name}>{item.name}</Text>
                </Pressable>
                <IconButton
                  name="chevron-up"
                  onPress={() => void move(index, -1)}
                  disabled={index === 0}
                  label={`Move ${item.name} up`}
                />
                <IconButton
                  name="chevron-down"
                  onPress={() => void move(index, 1)}
                  disabled={index === categories.length - 1}
                  label={`Move ${item.name} down`}
                />
                <IconButton
                  name="trash-outline"
                  onPress={() => confirmDelete(item)}
                  disabled={inUse[item.id] === true}
                  color="#dc2626"
                  label={`Delete ${item.name}`}
                />
              </>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexShrink: 1,
    paddingHorizontal: 20,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111',
  },
  hint: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 8,
    marginBottom: 4,
  },
  list: {
    flexGrow: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#f3f4f6',
  },
  nameArea: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    color: '#111',
  },
  renameInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#2563eb',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 16,
    color: '#111',
  },
  iconButton: {
    padding: 6,
  },
});
