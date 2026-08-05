import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

import Badge from '@/components/Badge';
import Button from '@/components/Button';
import Card from '@/components/Card';
import ProgressPill from '@/components/ProgressPill';
import { Screen } from '@/components/Screen';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
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

  // Refresco periódico + inmediato al recuperar el foco (volver de registrar)
  useEffect(() => {
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const display = getLocationDisplay(locationName);

  const today = new Date();
  const dateStr = today.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const statusLabel =
    status === 'closed' ? 'Registrado' :
    status === 'open' ? 'En curso' :
    'Pendiente';

  const statusVariant: 'success' | 'warning' | 'neutral' =
    status === 'closed' ? 'success' :
    status === 'open' ? 'warning' :
    'neutral';

  return (
    <Screen scrollable>
      {/* Título de la pantalla: cierre del día (la acción sigue siendo registrar sobrantes) */}
      <Stack.Screen options={{ title: 'Cierre del día' }} />

      {/* Location header */}
      <View style={styles.hero}>
        <View style={[styles.heroTile, { backgroundColor: display.tint }]}>
          <MaterialIcons name={display.icon} size={28} color={display.color} />
        </View>
        <Text style={styles.heroTitle}>{display.shortName}</Text>
        {!!display.description && (
          <Text style={styles.heroDescription}>{display.description}</Text>
        )}
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
            <ProgressPill current={entryCount} total={totalProducts} />
          </View>
        )}
      </Card>

      {/* Action */}
      <View style={styles.actionArea}>
        {status === 'closed' ? (
          <View style={styles.closedBox}>
            <MaterialIcons name="check-circle" size={48} color={Colors.success} />
            <Text style={styles.closedText}>Los sobrantes de hoy ya están registrados</Text>
            <Button
              title="Ver resumen del día"
              variant="ghost"
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
  heroTile: {
    width: 52,
    height: 52,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  heroTitle: {
    ...Typography.displayMedium,
    color: Colors.textPrimary,
  },
  heroDescription: {
    ...Typography.meta,
  },
  heroDate: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    textTransform: 'capitalize',
  },
  statusCard: {
    gap: Spacing.lg,
    padding: Spacing.xl,
    borderRadius: Radius.xl,
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
  actionArea: {
    marginTop: Spacing.xl,
  },
  closedBox: {
    alignItems: 'center',
    gap: Spacing.lg,
    paddingVertical: Spacing.xl,
  },
  closedText: {
    ...Typography.bodyLarge,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
