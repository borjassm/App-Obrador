import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

import Badge from '@/components/Badge';
import Button from '@/components/Button';
import Card from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { getLocationDisplay } from '@/constants/locations';
import { addDays, isoLocal } from '@/features/planning/pipelineScheduler';
import { shipmentsService, type ShipmentSummary } from '@/services/shipments.service';

function dateLabel(iso: string, todayISO: string): string {
  if (iso === todayISO) return 'Hoy';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function ShipmentsListScreen() {
  const [shipments, setShipments] = useState<ShipmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const todayISO = isoLocal(new Date());

  useFocusEffect(
    useCallback(() => {
      const since = isoLocal(addDays(new Date(), -7));
      shipmentsService.listRecent(since).then((data) => {
        setShipments(data);
        setLoading(false);
      });
    }, [])
  );

  return (
    <Screen scrollable>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          hitSlop={8}
        >
          <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <View style={styles.topText}>
          <Text style={styles.topTitle}>Envíos</Text>
          <Text style={styles.topSubtitle}>Últimos 7 días</Text>
        </View>
      </View>

      <Button title="Nuevo envío" onPress={() => router.push('/(tabs)/obrador/envios/nuevo')} />

      {loading ? (
        <View style={styles.stateBox}>
          <MaterialIcons name="hourglass-empty" size={48} color={Colors.textMuted} />
        </View>
      ) : shipments.length === 0 ? (
        <View style={styles.stateBox}>
          <MaterialIcons name="local-shipping" size={48} color={Colors.textMuted} />
          <Text style={styles.stateText}>
            Sin envíos esta semana. Crea el primero con «Nuevo envío».
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {shipments.map((s) => (
            <Card
              key={s.id}
              style={styles.shipmentCard}
              onPress={() => router.push(`/(tabs)/obrador/envios/${s.id}`)}
            >
              <View style={styles.shipmentInfo}>
                <Text style={styles.shipmentRoute} numberOfLines={1}>
                  {getLocationDisplay(s.originName).shortName} → {getLocationDisplay(s.destName).shortName}
                </Text>
                <Text style={styles.shipmentMeta}>
                  {dateLabel(s.shipmentDate, todayISO)} · viaje {s.trip} · {s.itemCount} productos ·{' '}
                  {s.totalSent.toLocaleString('es-ES')} uds
                </Text>
              </View>
              <Badge
                label={s.status === 'recibido' ? 'Recibido' : 'En camino'}
                variant={s.status === 'recibido' ? 'success' : 'warning'}
              />
              <MaterialIcons name="chevron-right" size={24} color={Colors.textMuted} />
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingTop: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topText: {
    flex: 1,
    gap: 2,
  },
  topTitle: {
    ...Typography.displayMedium,
    color: Colors.textPrimary,
  },
  topSubtitle: {
    ...Typography.meta,
  },
  stateBox: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xxxl,
  },
  stateText: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  list: {
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  shipmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  shipmentInfo: {
    flex: 1,
    gap: 2,
  },
  shipmentRoute: {
    ...Typography.headingSmall,
    color: Colors.textPrimary,
  },
  shipmentMeta: {
    ...Typography.meta,
    fontVariant: ['tabular-nums'],
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
