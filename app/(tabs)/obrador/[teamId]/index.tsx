import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

import Card from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { getLocationDisplay } from '@/constants/locations';
import { supabase } from '@/lib/supabase';
import { teamsService } from '@/services/teams.service';

interface LocationRow {
  id: string;
  name: string;
}

// Paso intermedio: en qué lugar está trabajando el equipo. Si el equipo solo
// produce en un sitio, saltamos directamente a su hoja de trabajo.
export default function TeamLocationPicker() {
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const [teamName, setTeamName] = useState('');
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    if (!teamId) return;
    (async () => {
      const { data: team } = await supabase
        .from('production_teams')
        .select('name')
        .eq('id', teamId)
        .single();
      if (team) setTeamName(team.name);

      const items = await teamsService.listItems(teamId);
      const locationIds = [...new Set(items.flatMap((i) => i.locationIds))];
      if (locationIds.length === 0) {
        setEmpty(true);
        return;
      }
      const { data: locs } = await supabase
        .from('locations')
        .select('id,name')
        .in('id', locationIds)
        .order('name');
      const rows = locs ?? [];
      if (rows.length === 1) {
        router.replace(`/(tabs)/obrador/${teamId}/${rows[0].id}`);
        return;
      }
      setLocations(rows);
    })();
  }, [teamId]);

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
        <Text style={styles.topTitle}>{teamName || 'Equipo'}</Text>
      </View>

      <Text style={styles.subtitle}>¿Dónde estás trabajando hoy?</Text>

      {empty ? (
        <View style={styles.stateBox}>
          <MaterialIcons name="pending-actions" size={48} color={Colors.textMuted} />
          <Text style={styles.stateText}>
            Este equipo aún no tiene productos asignados. El administrador los cargará pronto.
          </Text>
        </View>
      ) : (
        locations.map((loc) => {
          const display = getLocationDisplay(loc.name);
          return (
            <Card
              key={loc.id}
              style={styles.locationCard}
              onPress={() => router.push(`/(tabs)/obrador/${teamId}/${loc.id}`)}
            >
              <View style={[styles.iconTile, { backgroundColor: display.tint }]}>
                <MaterialIcons name={display.icon} size={26} color={display.color} />
              </View>
              <View style={styles.locationInfo}>
                <Text style={styles.locationName}>{display.shortName}</Text>
                {!!display.description && (
                  <Text style={styles.locationDetail}>{display.description}</Text>
                )}
              </View>
              <MaterialIcons name="chevron-right" size={26} color={Colors.textMuted} />
            </Card>
          );
        })
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
    marginBottom: Spacing.sm,
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
  topTitle: {
    ...Typography.displayMedium,
    color: Colors.textPrimary,
  },
  subtitle: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
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
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    marginBottom: Spacing.lg,
    padding: Spacing.xl,
  },
  iconTile: {
    width: 52,
    height: 52,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationInfo: {
    flex: 1,
    gap: 2,
  },
  locationName: {
    ...Typography.headingMedium,
    color: Colors.textPrimary,
  },
  locationDetail: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
