import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography, getFamilyColor } from '@/constants/theme';
import { getFamilyEmoji } from '@/constants/products';

interface Props {
  title: string;
  color?: string;
  family?: string;
  count?: number;
}

export default function SectionHeader({ title, color, family, count }: Props) {
  const accentColor = color ?? (family ? getFamilyColor(family) : Colors.primary);
  const emoji = family ? getFamilyEmoji(family) : null;

  return (
    <View style={styles.container}>
      <View style={[styles.accent, { backgroundColor: accentColor }]} />
      {emoji && <Text style={styles.emoji}>{emoji}</Text>}
      <Text style={styles.title}>{title}</Text>
      {count !== undefined && (
        <Text style={styles.count}>{count}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  accent: {
    width: 4,
    height: 24,
    borderRadius: Radius.sm,
  },
  emoji: {
    fontSize: 20,
  },
  title: {
    ...Typography.headingSmall,
    color: Colors.textPrimary,
    flex: 1,
  },
  count: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
});
