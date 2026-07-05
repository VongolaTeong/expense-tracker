import { StyleSheet, Text, View } from 'react-native';

interface Props {
  label: string;
}

/** Day header between expense groups, e.g. "Sat, 4 Jul". */
export function DateSeparator({ label }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 5,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
});
