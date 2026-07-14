import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';

type Variant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface Props {
  label: string;
  variant?: Variant;
}

const COLORS: Record<Variant, { bg: string; text: string }> = {
  success: { bg: Colors.successLight, text: Colors.success },
  warning: { bg: Colors.warningLight, text: Colors.warning },
  danger: { bg: Colors.dangerLight, text: Colors.danger },
  info: { bg: Colors.infoLight, text: Colors.info },
  neutral: { bg: Colors.borderLight, text: Colors.textSecondary },
};

export default function Badge({ label, variant = 'neutral' }: Props) {
  const { bg, text } = COLORS[variant];

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.label, { color: text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
  },
  label: {
    ...Typography.labelSmall,
  },
});
