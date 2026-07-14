import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';

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

/** Segmented control: pill blanca activa sobre track crema (rediseño v1) */
export default function FilterPills({ options, selected, onSelect }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.wrapper}
    >
      <View style={styles.track}>
        {options.map((option) => {
          const isActive = option.key === selected;
          const activeColor = option.color ?? Colors.textPrimary;

          return (
            <Pressable
              key={option.key}
              onPress={() => onSelect(option.key)}
              style={({ pressed }) => [
                styles.segment,
                isActive && styles.segmentActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.label, isActive && { color: activeColor }]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  track: {
    flexDirection: 'row',
    backgroundColor: '#EFE6D8',
    borderRadius: Radius.full,
    padding: 4,
    gap: 2,
  },
  segment: {
    height: 36,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: Colors.bgCard,
    ...Shadows.sm,
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    ...Typography.labelMedium,
    fontSize: 13,
    color: Colors.textSecondary,
  },
});
