import { StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing, Typography, getFamilyColor } from '@/constants/theme';

interface Props {
  title: string;
  color?: string;
  family?: string;
  count?: number;
}

// Label de sección del rediseño v1: texto uppercase muted (Typography.sectionLabel),
// con punto de color opcional (familia) y contador a la derecha. Sin emojis.
export default function SectionHeader({ title, color, family, count }: Props) {
  const accentColor = color ?? (family ? getFamilyColor(family) : undefined);

  return (
    <View style={styles.container}>
      {accentColor ? <View style={[styles.dot, { backgroundColor: accentColor }]} /> : null}
      <Text style={styles.title}>{title}</Text>
      {count !== undefined && <Text style={styles.count}>{count}</Text>}
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
  dot: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
  },
  title: {
    ...Typography.sectionLabel,
    flex: 1,
  },
  count: {
    ...Typography.meta,
    fontVariant: ['tabular-nums'],
  },
});
