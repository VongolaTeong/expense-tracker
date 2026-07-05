import { StyleSheet, Text, View } from 'react-native';

interface Props {
  title: string;
  hint?: string;
}

export function EmptyState({ title, hint }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  title: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  hint: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 6,
  },
});
