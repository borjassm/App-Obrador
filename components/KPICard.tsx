import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import Card from '@/components/Card';
import { Colors, Fonts, Radius, Spacing, Typography } from '@/constants/theme';

interface Props {
  label: string;
  value: string | number;
  unit?: string;
  trend?: { direction: 'up' | 'down' | 'flat'; label: string };
  color?: string;
}

const TREND_ICON: Record<'up' | 'down' | 'flat', 'trending-up' | 'trending-down' | 'trending-flat'> = {
  up: 'trending-up',
  down: 'trending-down',
  flat: 'trending-flat',
};

export default function KPICard({ label, value, unit, trend, color = Colors.textPrimary }: Props) {
  const trendColor =
    trend?.direction === 'up' ? Colors.success :
    trend?.direction === 'down' ? Colors.danger :
    Colors.textMuted;

  const trendBg =
    trend?.direction === 'up' ? Colors.successLight :
    trend?.direction === 'down' ? Colors.dangerLight :
    Colors.divider;

  return (
    <Card shadow="sm" style={styles.card}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.valueRow}>
        <Text style={[styles.value, { color }]}>{value}</Text>
        {unit && <Text style={styles.unit}>{unit}</Text>}
      </View>

      {trend && (
        <View style={[styles.trendBadge, { backgroundColor: trendBg }]}>
          <MaterialIcons name={TREND_ICON[trend.direction]} size={14} color={trendColor} />
          <Text style={[styles.trendText, { color: trendColor }]}>{trend.label}</Text>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 140,
    gap: Spacing.xs,
  },
  label: {
    fontFamily: Fonts.bold,
    fontSize: 12.5,
    lineHeight: 17,
    color: Colors.textMuted,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.xs,
  },
  value: {
    ...Typography.numberLarge,
  },
  unit: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
  trendBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
    marginTop: Spacing.xs,
  },
  trendText: {
    fontFamily: Fonts.extraBold,
    fontSize: 12,
    lineHeight: 16,
  },
});
