import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import Badge from '@/components/Badge';
import Button from '@/components/Button';
import Card from '@/components/Card';
import ProgressPill from '@/components/ProgressPill';
import { Screen } from '@/components/Screen';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { getLocationDisplay } from '@/constants/locations';
import { useLocationStatus } from '@/hooks/useLocationStatus';
import { supabase } from '@/lib/supabase';

export default function LocationDashboard() {
  const { locationId } = useLocalSearchParams<{ locationId: string }>();
  const [locationName, setLocationName] = useState('');
  const { status, entryCount, totalProducts, loading: _loading, refresh } = useLocationStatus(locationId);

  useEffect(() => {
    if (!locationId) return;
    supabase
      .from('locations')
      .select('name')
      .eq('id', locationId)
      .single()
      .then(({ data }) => {
        if (data) setLocationName(data.name);
      });
  }, [locationId]);

  // Refresh on focus
  useEffect(() => {
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  const display = getLocationDisplay(locationName);

  const today = new Date();
  const dateStr = today.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const statusLabel =
    status === 'closed' ? 'Registrado ✓' :
    status === 'open' ? 'En curso' :
    'Pendiente';

  const statusVariant: 'success' | 'warning' | 'neutral' =
    status === 'closed' ? 'success' :
    status === 'open' ? 'warning' :
    'neutral';

  return (
    <Screen scrollable>
      {/* Location header */}
      <View style={styles.hero}>
        <Text style={styles.heroEmoji}>{display.emoji}</Text>
        <Text style={styles.heroTitle}>{display.shortName}</Text>
        <Text style={styles.heroDate}>{dateStr}</Text>
      </View>

      {/* Status card */}
      <Card style={styles.statusCard}>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Estado del día</Text>
          <Badge label={statusLabel} variant={statusVariant} />
        </View>

        {status !== 'none' && totalProducts > 0 && (
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Productos registrados</Text>
            <ProgressPill current={entryCount} total={totalProducts} />
          </View>
        )}
      </Card>

      {/* Action */}
      <View style={styles.actionArea}>
        {status === 'closed' ? (
          <View style={styles.closedBox}>
            <Text style={styles.closedEmoji}>✅</Text>
            <Text style={styles.closedText}>Los sobrantes de hoy ya están registrados</Text>
            <Button
              title="Ver resumen"
              variant="secondary"
              onPress={() => router.push(`/(tabs)/location/${locationId}/close`)}
            />
          </View>
        ) : (
          <Button
            title={status === 'open' ? 'Continuar registro' : 'Registrar sobrantes'}
            onPress={() => router.push(`/(tabs)/location/${locationId}/close`)}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.xs,
  },
  heroEmoji: {
    fontSize: 56,
    marginBottom: Spacing.sm,
  },
  heroTitle: {
    ...Typography.displayMedium,
    color: Colors.textPrimary,
  },
  heroDate: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    textTransform: 'capitalize',
  },
  statusCard: {
    gap: Spacing.lg,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    ...Typography.labelMedium,
    color: Colors.textPrimary,
  },
  progressRow: {
    gap: Spacing.sm,
  },
  progressLabel: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
  actionArea: {
    marginTop: Spacing.xl,
  },
  closedBox: {
    alignItems: 'center',
    gap: Spacing.lg,
    paddingVertical: Spacing.xl,
  },
  closedEmoji: {
    fontSize: 48,
  },
  closedText: {
    ...Typography.bodyLarge,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
