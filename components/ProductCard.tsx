import { StyleSheet, Text, View } from 'react-native';

import Card from '@/components/Card';
import { Colors, Radius, Spacing, Typography, getFamilyColor } from '@/constants/theme';
import { getProductEmoji } from '@/constants/products';

interface Props {
  name: string;
  family: string;
  savedQty?: number;
  onPress: () => void;
}

export default function ProductCard({ name, family, savedQty, onPress }: Props) {
  const familyColor = getFamilyColor(family);
  const emoji = getProductEmoji(name);
  const hasData = (savedQty ?? 0) > 0;

  return (
    <Card onPress={onPress} shadow="sm" style={styles.card}>
      <View style={[styles.familyBar, { backgroundColor: familyColor }]} />
      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={styles.emoji}>{emoji}</Text>
          <View style={styles.info}>
            <Text style={styles.name}>{name}</Text>
            <Text style={[styles.family, { color: familyColor }]}>
              {family.charAt(0).toUpperCase() + family.slice(1)}
            </Text>
          </View>
          {hasData ? (
            <View style={[styles.qtyBadge, { backgroundColor: Colors.primaryLight + '20' }]}>
              <Text style={[styles.qtyNum, { color: Colors.primary }]}>{savedQty}</Text>
              <Text style={styles.qtyLabel}>uds</Text>
            </View>
          ) : (
            <Text style={styles.pending}>Pendiente</Text>
          )}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 0,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  familyBar: {
    width: 5,
  },
  body: {
    flex: 1,
    padding: Spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  emoji: {
    fontSize: 28,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...Typography.labelLarge,
    color: Colors.textPrimary,
  },
  family: {
    ...Typography.bodySmall,
  },
  qtyBadge: {
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    minWidth: 56,
  },
  qtyNum: {
    ...Typography.numberSmall,
  },
  qtyLabel: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    fontSize: 10,
  },
  pending: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
  },
});
