import { StyleSheet, Text, View } from 'react-native';

import Stepper from '@/components/Stepper';
import { Colors, Spacing, Typography } from '@/constants/theme';

interface Props {
  label: string;
  value: number;
  onChange: (value: number) => void;
  color?: string;
}

export default function QuantityDisplay({ label, value, onChange, color = Colors.primary }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.display}>
        <Text style={[styles.number, { color }]}>{value}</Text>
        <Text style={styles.unit}>uds</Text>
      </View>

      <Stepper value={value} onChange={onChange} color={color} min={0} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xl,
  },
  label: {
    ...Typography.headingMedium,
    color: Colors.textPrimary,
  },
  display: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  number: {
    fontSize: 64,
    fontWeight: '700',
    lineHeight: 72,
  },
  unit: {
    ...Typography.bodyLarge,
    color: Colors.textMuted,
  },
});
