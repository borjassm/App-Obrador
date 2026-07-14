import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import Card from '@/components/Card';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

const STEPS = [-5, -1, 1, 5];

interface Props {
  label: string;
  hint?: string;
  /** Icono de MaterialIcons (Guardado = archive, Tirado = delete) */
  icon?: IconName;
  value: number;
  onChange: (value: number) => void;
  color?: string;
  /** Fondo suave del icon-tile; por defecto tinte del color */
  tint?: string;
  /** counter = 56 (móvil) · hero = 72 (tablet) */
  size?: 'counter' | 'hero';
  style?: ViewStyle;
}

export default function QuantityDisplay({
  label,
  hint,
  icon,
  value,
  onChange,
  color = Colors.primary,
  tint,
  size = 'counter',
  style,
}: Props) {
  const handleStep = (delta: number) => {
    onChange(Math.max(0, value + delta));
  };

  return (
    <Card shadow="sm" style={{ ...styles.card, ...style }}>
      <View style={styles.header}>
        {icon && (
          <View style={[styles.iconTile, { backgroundColor: tint ?? color + '1A' }]}>
            <MaterialIcons name={icon} size={22} color={color} />
          </View>
        )}
        <View style={styles.headerText}>
          <Text style={styles.label}>{label}</Text>
          {hint && <Text style={styles.hint}>{hint}</Text>}
        </View>
      </View>

      <View style={styles.display}>
        <Text style={[size === 'hero' ? Typography.numberHero : Typography.numberCounter, { color }]}>
          {value}
        </Text>
        <Text style={styles.unit}>uds</Text>
      </View>

      <View style={styles.steps}>
        {STEPS.map((step) => {
          const disabled = step < 0 && value === 0;
          return (
            <Pressable
              key={step}
              onPress={() => handleStep(step)}
              disabled={disabled}
              style={({ pressed }) => [
                styles.stepBtn,
                step > 0 ? { backgroundColor: color } : styles.stepBtnMinus,
                pressed && styles.pressed,
                disabled && styles.disabled,
              ]}
            >
              <Text style={[styles.stepText, step > 0 ? styles.stepTextPlus : null]}>
                {step > 0 ? `+${step}` : String(step)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.xl,
    gap: Spacing.lg,
    alignItems: 'stretch',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  label: {
    ...Typography.headingMedium,
    color: Colors.textPrimary,
  },
  hint: {
    ...Typography.meta,
  },
  display: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  unit: {
    ...Typography.bodyLarge,
    color: Colors.textMuted,
  },
  steps: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  stepBtn: {
    minWidth: 60,
    minHeight: 60,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnMinus: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  stepText: {
    ...Typography.labelLarge,
    color: Colors.textSecondary,
  },
  stepTextPlus: {
    color: Colors.textOnPrimary,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.3,
  },
});
