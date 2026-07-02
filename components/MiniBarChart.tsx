import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';

export interface BarPoint {
  label?: string;
  value: number;
  highlight?: boolean;
}

interface Props {
  points: BarPoint[];
  height?: number;
  color?: string;
  highlightColor?: string;
  showLabels?: boolean;
}

/** Gráfico de barras simple basado en Views: cero dependencias, funciona en web y nativo. */
export default function MiniBarChart({
  points,
  height = 120,
  color = Colors.primary,
  highlightColor = Colors.secondary,
  showLabels = true,
}: Props) {
  const max = Math.max(...points.map((p) => p.value), 1);

  return (
    <View>
      <View style={[styles.chart, { height }]}>
        {points.map((p, i) => (
          <View key={i} style={styles.barCol}>
            <View
              style={[
                styles.bar,
                {
                  height: Math.max(3, (p.value / max) * (height - 8)),
                  backgroundColor: p.highlight ? highlightColor : color,
                },
              ]}
            />
          </View>
        ))}
      </View>
      {showLabels && (
        <View style={styles.labels}>
          {points.map((p, i) => (
            <View key={i} style={styles.barCol}>
              {p.label != null && <Text style={styles.label} numberOfLines={1}>{p.label}</Text>}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
  },
  bar: {
    width: '70%',
    minWidth: 3,
    borderTopLeftRadius: Radius.sm / 2,
    borderTopRightRadius: Radius.sm / 2,
  },
  labels: {
    flexDirection: 'row',
    gap: 2,
    marginTop: Spacing.xs,
  },
  label: {
    ...Typography.bodySmall,
    fontSize: 10,
    color: Colors.textMuted,
  },
});
