import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { deleteAllExpenses, seedTestExpenses } from '../db/devSeed';
import {
  deleteBackup,
  exportAndShare,
  listBackups,
  shareBackup,
} from '../services/backup';
import type { BackupFileInfo } from '../services/backup';
import { importCsv } from '../services/importer';

interface Props {
  visible: boolean;
  onClose: () => void;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function SettingsScreen({ visible, onClose }: Props) {
  const [backups, setBackups] = useState<BackupFileInfo[]>([]);
  const [busy, setBusy] = useState(false);

  const refreshBackups = useCallback(() => {
    try {
      setBackups(listBackups());
    } catch (err) {
      Alert.alert('Error', errorMessage(err));
    }
  }, []);

  useEffect(() => {
    if (visible) refreshBackups();
  }, [visible, refreshBackups]);

  const onExport = async () => {
    setBusy(true);
    try {
      await exportAndShare();
    } catch (err) {
      Alert.alert('Export failed', errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const onImport = async () => {
    setBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const content = await new File(result.assets[0].uri).text();
      const summary = await importCsv(content);
      Alert.alert(
        'Import complete',
        `Imported ${summary.imported}, updated ${summary.updated}, skipped ${summary.skipped}.`
      );
    } catch (err) {
      Alert.alert('Import failed', errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  // DEV-only (see __DEV__ section below): performance sanity tooling.
  const onSeed = async () => {
    setBusy(true);
    try {
      const startedAt = Date.now();
      await seedTestExpenses(5000);
      Alert.alert('Seeded', `5,000 expenses in ${((Date.now() - startedAt) / 1000).toFixed(1)}s.`);
    } catch (err) {
      Alert.alert('Seed failed', errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const onWipe = () => {
    Alert.alert('Wipe ALL expenses?', 'Dev tool — removes every expense. Categories stay.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Wipe',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await deleteAllExpenses();
            } catch (err) {
              Alert.alert('Wipe failed', errorMessage(err));
            }
          })();
        },
      },
    ]);
  };

  const onShareBackup = async (backup: BackupFileInfo) => {
    try {
      await shareBackup(backup.uri);
    } catch (err) {
      Alert.alert('Share failed', errorMessage(err));
    }
  };

  const onDeleteBackup = (backup: BackupFileInfo) => {
    Alert.alert('Delete backup?', backup.name, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          try {
            deleteBackup(backup.uri);
            refreshBackups();
          } catch (err) {
            Alert.alert('Delete failed', errorMessage(err));
          }
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Settings</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close settings">
              <Ionicons name="close" size={24} color="#6b7280" />
            </Pressable>
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={() => void onExport()}
              disabled={busy}
              style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
            >
              <Ionicons name="share-outline" size={20} color="#2563eb" />
              <Text style={styles.actionText}>Export CSV</Text>
            </Pressable>
            <Pressable
              onPress={() => void onImport()}
              disabled={busy}
              style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
            >
              <Ionicons name="download-outline" size={20} color="#2563eb" />
              <Text style={styles.actionText}>Import CSV</Text>
            </Pressable>
          </View>

          {__DEV__ ? (
            <>
              <Text style={styles.sectionTitle}>Developer</Text>
              <View style={styles.actions}>
                <Pressable
                  onPress={() => void onSeed()}
                  disabled={busy}
                  style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
                >
                  <Ionicons name="flask-outline" size={20} color="#2563eb" />
                  <Text style={styles.actionText}>Seed 5,000</Text>
                </Pressable>
                <Pressable
                  onPress={onWipe}
                  disabled={busy}
                  style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
                >
                  <Ionicons name="trash-outline" size={20} color="#dc2626" />
                  <Text style={[styles.actionText, styles.dangerText]}>Wipe expenses</Text>
                </Pressable>
              </View>
            </>
          ) : null}

          <Text style={styles.sectionTitle}>Backups</Text>
          <Text style={styles.sectionHint}>
            A full backup is written automatically once a month.
          </Text>
          {backups.length === 0 ? (
            <Text style={styles.emptyText}>No backups yet.</Text>
          ) : (
            <FlatList
              data={backups}
              keyExtractor={(item) => item.uri}
              style={styles.list}
              renderItem={({ item }) => (
                <View style={styles.backupRow}>
                  <Text style={styles.backupName}>{item.name}</Text>
                  <Pressable
                    onPress={() => void onShareBackup(item)}
                    hitSlop={8}
                    accessibilityLabel={`Share ${item.name}`}
                    style={styles.iconButton}
                  >
                    <Ionicons name="share-outline" size={20} color="#2563eb" />
                  </Pressable>
                  <Pressable
                    onPress={() => onDeleteBackup(item)}
                    hitSlop={8}
                    accessibilityLabel={`Delete ${item.name}`}
                    style={styles.iconButton}
                  >
                    <Ionicons name="trash-outline" size={20} color="#dc2626" />
                  </Pressable>
                </View>
              )}
            />
          )}
        </View>
      </View>
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
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  actionText: {
    color: '#2563eb',
    fontSize: 15,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
  dangerText: {
    color: '#dc2626',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
    paddingHorizontal: 20,
    marginTop: 14,
  },
  sectionHint: {
    fontSize: 12,
    color: '#9ca3af',
    paddingHorizontal: 20,
    marginTop: 2,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  list: {
    flexGrow: 0,
  },
  backupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#f3f4f6',
  },
  backupName: {
    flex: 1,
    fontSize: 14,
    color: '#111',
    fontVariant: ['tabular-nums'],
  },
  iconButton: {
    padding: 6,
  },
});
