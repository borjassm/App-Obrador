import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';

interface Props {
  current: number;
  total: number;
  label?: string;
}

// Bloque de progreso del rediseño v1 (1b/1g): fila de label + "X de Y"
// sobre barra de 8px con track primaryTint y fill primary (success al completar).
export default function ProgressPill({ current, total, label = 'Sobrantes registrados' }: Props) {
  const pct = total > 0 ? Math.min((current / total) * 100, 100) : 0;
  const done = current === total && total > 0;
  const fillColor = done ? Colors.success : Colors.primary;

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.count}>
          {current} de {total}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: fillColor }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    gap: Spacing.sm,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  label: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  count: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 8,
    backgroundColor: Colors.primaryTint,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: Radius.full,
  },
});
