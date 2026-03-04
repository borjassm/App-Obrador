import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Shadows, Spacing, TOUCH_TARGET_MIN, Typography } from '@/constants/theme';

interface Props {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  label?: string;
  color?: string;
}

const STEPS = [-5, -1, 1, 5];

export default function Stepper({ value, onChange, min = 0, label, color = Colors.primary }: Props) {
  const handleStep = (delta: number) => {
    const next = value + delta;
    onChange(Math.max(min, next));
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}

      <Text style={[styles.value, { color }]}>{value}</Text>

      <View style={styles.buttons}>
        {STEPS.map((step) => (
          <Pressable
            key={step}
            onPress={() => handleStep(step)}
            disabled={step < 0 && value + step < min}
            style={({ pressed }) => [
              styles.btn,
              step > 0 ? { backgroundColor: color } : styles.btnMinus,
              pressed && styles.pressed,
              step < 0 && value + step < min && styles.disabled,
            ]}
          >
            <Text style={[styles.btnText, step > 0 ? styles.btnTextPlus : { color: Colors.textSecondary }]}>
              {step > 0 ? `+${step}` : String(step)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  label: {
    ...Typography.labelMedium,
    color: Colors.textSecondary,
  },
  value: {
    ...Typography.numberLarge,
  },
  buttons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  btn: {
    minWidth: TOUCH_TARGET_MIN,
    minHeight: TOUCH_TARGET_MIN,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  btnMinus: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  btnText: {
    ...Typography.labelLarge,
  },
  btnTextPlus: {
    color: Colors.textOnPrimary,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.95 }],
  },
  disabled: {
    opacity: 0.3,
  },
});
