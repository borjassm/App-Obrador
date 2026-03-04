import { StyleSheet, Text, View } from 'react-native';

import Card from '@/components/Card';
import Badge from '@/components/Badge';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { getLocationDisplay } from '@/constants/locations';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface Props {
  locationName: string;
  status: string;
  statusVariant?: BadgeVariant;
  onPress: () => void;
}

export default function LocationCard({
  locationName,
  status,
  statusVariant = 'neutral',
  onPress,
}: Props) {
  const display = getLocationDisplay(locationName);

  return (
    <Card onPress={onPress} shadow="lg" style={styles.card}>
      <View style={[styles.accentBar, { backgroundColor: display.color }]} />
      <View style={styles.body}>
        <Text style={styles.emoji}>{display.emoji}</Text>
        <Text style={styles.name}>{display.shortName}</Text>
        <Text style={styles.description}>{display.description}</Text>
        <Badge label={status} variant={statusVariant} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 200,
    padding: 0,
    overflow: 'hidden',
  },
  accentBar: {
    height: 6,
  },
  body: {
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emoji: {
    fontSize: 48,
    marginBottom: Spacing.xs,
  },
  name: {
    ...Typography.displayMedium,
    color: Colors.textPrimary,
  },
  description: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
  },
});
