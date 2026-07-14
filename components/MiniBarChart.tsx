import { StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts, Spacing } from '@/constants/theme';

export interface BarPoint {
  label?: string;
  value: number;
  /** Barra destacada (por encima de la media) — arena tostada */
  highlight?: boolean;
  /** Barra pico (valor máximo) — espresso */
  peak?: boolean;
}

interface Props {
  points: BarPoint[];
  height?: number;
  color?: string;
  highlightColor?: string;
  peakColor?: string;
  showLabels?: boolean;
}

/** Gráfico de barras simple basado en Views: cero dependencias, funciona en web y nativo.
 *  Rediseño v1: barras normal #E4D5C0 / destacada #C99B62 / pico #6F4A26, radius 5 arriba. */
export default function MiniBarChart({
  points,
  height = 120,
  color = '#E4D5C0',
  highlightColor = Colors.familyPanaderia,
  peakColor = Colors.primary,
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
                  backgroundColor: p.peak ? peakColor : p.highlight ? highlightColor : color,
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
    gap: 3,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
  },
  bar: {
    width: '72%',
    minWidth: 3,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
  },
  labels: {
    flexDirection: 'row',
    gap: 3,
    marginTop: Spacing.sm,
  },
  label: {
    fontFamily: Fonts.semiBold,
    fontSize: 11,
    lineHeight: 14,
    color: Colors.textMuted,
  },
});
