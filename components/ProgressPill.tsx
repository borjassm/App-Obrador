import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';

interface Props {
  current: number;
  total: number;
}

export default function ProgressPill({ current, total }: Props) {
  const pct = total > 0 ? (current / total) * 100 : 0;
  const done = current === total && total > 0;

  return (
    <View style={styles.container}>
      <View style={styles.barBg}>
        <View
          style={[
            styles.barFill,
            { width: `${pct}%`, backgroundColor: done ? Colors.success : Colors.primary },
          ]}
        />
      </View>
      <Text style={[styles.label, done && { color: Colors.success }]}>
        {current} de {total}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  barBg: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.borderLight,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  label: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    minWidth: 50,
    textAlign: 'right',
  },
});
