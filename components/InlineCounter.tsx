import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

interface Props {
  label: string;
  value: number;
  onChange: (value: number) => void;
  color?: string;
  disabled?: boolean;
}

// Contador compacto − valor + para rellenar listas largas sin salir de la fila
export default function InlineCounter({
  label,
  value,
  onChange,
  color = Colors.primary,
  disabled,
}: Props) {
  const canDecrease = !disabled && value > 0;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.controls}>
        <Pressable
          onPress={() => onChange(Math.max(0, value - 1))}
          disabled={!canDecrease}
          hitSlop={4}
          accessibilityLabel={`Restar ${label}`}
          style={({ pressed }) => [
            styles.btn,
            styles.btnMinus,
            pressed && styles.pressed,
            !canDecrease && styles.btnDisabled,
          ]}
        >
          <MaterialIcons name="remove" size={20} color={Colors.textSecondary} />
        </Pressable>
        <Text style={[styles.value, value > 0 && { color }]}>{value}</Text>
        <Pressable
          onPress={() => onChange(value + 1)}
          disabled={disabled}
          hitSlop={4}
          accessibilityLabel={`Sumar ${label}`}
          style={({ pressed }) => [
            styles.btn,
            { backgroundColor: color },
            pressed && styles.pressed,
            disabled && styles.btnDisabled,
          ]}
        >
          <MaterialIcons name="add" size={20} color={Colors.textOnPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 2,
  },
  label: {
    fontFamily: Fonts.bold,
    fontSize: 10.5,
    lineHeight: 13,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: Colors.textMuted,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  btn: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnMinus: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  btnDisabled: {
    opacity: 0.35,
  },
  value: {
    minWidth: 30,
    textAlign: 'center',
    fontFamily: Fonts.extraBold,
    fontSize: 18,
    lineHeight: 22,
    color: Colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.95 }],
  },
});
