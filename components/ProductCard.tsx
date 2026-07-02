import { StyleSheet, Text, View } from 'react-native';

import Card from '@/components/Card';
import { Colors, Radius, Spacing, Typography, getFamilyColor } from '@/constants/theme';
import { getProductEmoji } from '@/constants/products';

interface Props {
  name: string;
  family: string;
  savedQty?: number;
  discardedQty?: number;
  onPress: () => void;
}

export default function ProductCard({ name, family, savedQty, discardedQty, onPress }: Props) {
  const familyColor = getFamilyColor(family);
  const emoji = getProductEmoji(name);
  const saved = savedQty ?? 0;
  const discarded = discardedQty ?? 0;
  const hasData = saved > 0 || discarded > 0;

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
            <View style={styles.badges}>
              <View style={[styles.qtyBadge, { backgroundColor: Colors.primaryLight + '20' }]}>
                <Text style={[styles.qtyNum, { color: Colors.primary }]}>{saved}</Text>
                <Text style={styles.qtyLabel}>guard.</Text>
              </View>
              {discarded > 0 && (
                <View style={[styles.qtyBadge, { backgroundColor: Colors.dangerLight }]}>
                  <Text style={[styles.qtyNum, { color: Colors.danger }]}>{discarded}</Text>
                  <Text style={styles.qtyLabel}>tirado</Text>
                </View>
              )}
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
  badges: {
    flexDirection: 'row',
    gap: Spacing.xs,
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
