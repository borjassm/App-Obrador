import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { Colors, Radius, Shadows, Spacing, TOUCH_TARGET_MIN, Typography } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface Props {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  style?: ViewStyle;
}

const BG: Record<Variant, string> = {
  primary: Colors.primary,
  secondary: Colors.secondary,
  ghost: 'transparent',
  danger: Colors.danger,
};

const TEXT_COLOR: Record<Variant, string> = {
  primary: Colors.textOnPrimary,
  secondary: Colors.textOnPrimary,
  ghost: Colors.primary,
  danger: Colors.textOnPrimary,
};

export default function Button({ title, onPress, variant = 'primary', disabled, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: BG[variant] },
        variant === 'primary' && !disabled && Shadows.cta,
        variant === 'ghost' && styles.ghost,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.label, { color: TEXT_COLOR[variant] }]}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: TOUCH_TARGET_MIN,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghost: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    ...Typography.labelLarge,
  },
});
