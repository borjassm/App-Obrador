import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, TOUCH_TARGET_MIN, Typography } from '@/constants/theme';

interface FilterOption {
  key: string;
  label: string;
  color?: string;
}

interface Props {
  options: FilterOption[];
  selected: string;
  onSelect: (key: string) => void;
}

export default function FilterPills({ options, selected, onSelect }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {options.map((option) => {
        const isActive = option.key === selected;
        const activeColor = option.color ?? Colors.primary;

        return (
          <Pressable
            key={option.key}
            onPress={() => onSelect(option.key)}
            style={[
              styles.pill,
              isActive && { backgroundColor: activeColor, borderColor: activeColor },
            ]}
          >
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  pill: {
    minHeight: TOUCH_TARGET_MIN - 12,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
  },
  labelActive: {
    color: Colors.textOnPrimary,
  },
});
