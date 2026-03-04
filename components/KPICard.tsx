import { StyleSheet, Text, View } from 'react-native';

import Card from '@/components/Card';
import { Colors, Spacing, Typography } from '@/constants/theme';

interface Props {
  label: string;
  value: string | number;
  unit?: string;
  trend?: { direction: 'up' | 'down' | 'flat'; label: string };
  color?: string;
}

export default function KPICard({ label, value, unit, trend, color = Colors.primary }: Props) {
  const trendColor =
    trend?.direction === 'up' ? Colors.success :
    trend?.direction === 'down' ? Colors.danger :
    Colors.textMuted;

  const trendIcon =
    trend?.direction === 'up' ? '↑' :
    trend?.direction === 'down' ? '↓' :
    '→';

  return (
    <Card shadow="sm" style={styles.card}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.valueRow}>
        <Text style={[styles.value, { color }]}>{value}</Text>
        {unit && <Text style={styles.unit}>{unit}</Text>}
      </View>

      {trend && (
        <View style={[styles.trendBadge, { backgroundColor: `${trendColor}18` }]}>
          <Text style={[styles.trendText, { color: trendColor }]}>
            {trendIcon} {trend.label}
          </Text>
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
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.xs,
  },
  value: {
    ...Typography.numberMedium,
  },
  unit: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
  trendBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: Spacing.xs,
  },
  trendText: {
    ...Typography.bodySmall,
    fontWeight: '600',
  },
});
