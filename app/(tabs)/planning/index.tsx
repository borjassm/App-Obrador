import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';

import Card from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Colors, Fonts, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useRole } from '@/hooks/useRole';
import { analyticsService } from '@/services/analytics.service';
import { planningService, type AccuracyStats } from '@/services/planning.service';
import { supabase } from '@/lib/supabase';
import { teamsService, type Team } from '@/services/teams.service';

export default function PlanningTeamsScreen() {
  const { isAdmin, loading: roleLoading } = useRole();
  const [teams, setTeams] = useState<Team[]>([]);
  const [accuracy, setAccuracy] = useState<AccuracyStats | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      teamsService.listTeams().then((data) => {
        setTeams(data);
        setLoading(false);
      });
    }, [])
  );

  // Mejora continua: cerrar el ciclo de planes pasados con ventas cargadas
  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const latest = await analyticsService.latestDates();
      if (latest?.latest_sale) {
        const { data: pastPlans } = await supabase
          .from('production_plans')
          .select('plan_date')
          .lte('plan_date', latest.latest_sale)
          .order('plan_date', { ascending: false })
          .limit(60);
        const uniqueDates = [...new Set((pastPlans ?? []).map((p) => p.plan_date))].slice(0, 10);
        for (const d of uniqueDates) await planningService.recordAccuracy(d);
      }
      setAccuracy(await planningService.accuracyStats(90));
    })();
  }, [isAdmin]);

  if (!roleLoading && !isAdmin) {
    return (
      <Screen>
        <View style={styles.stateBox}>
          <MaterialIcons name="lock-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.stateText}>
            El plan lo gestiona el administrador. Tu trabajo del día está en la pestaña Obrador.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scrollable>
      <View style={styles.header}>
        <Text style={styles.subtitle}>
          Elige un equipo para fijar qué se hornea hoy y qué se amasa para mañana
        </Text>
        <Text style={styles.title}>Plan de producción</Text>
      </View>

      {/* Precisión del modelo */}
      <View style={styles.accuracyCard}>
        <View style={styles.accuracyIconTile}>
          <MaterialCommunityIcons name="target" size={24} color={Colors.secondaryLight} />
        </View>
        <View style={styles.accuracyInfo}>
          <Text style={styles.accuracyTitle}>
            {accuracy ? 'Precisión del modelo (90 días)' : 'Mejora continua activada'}
          </Text>
          <Text style={styles.accuracyDetail}>
            {accuracy
              ? `${accuracy.n} predicciones evaluadas · ${accuracy.hit_rate}% con error ≤ 20%. El modelo se ajusta solo con cada día de ventas.`
              : 'Cuando cargues ventas de días ya planificados, el modelo medirá su acierto y ajustará sus pesos automáticamente.'}
          </Text>
        </View>
        {accuracy && (
          <Text style={styles.accuracyBig}>{Math.max(0, 100 - accuracy.mape).toFixed(0)}%</Text>
        )}
      </View>

      {loading ? (
        <View style={styles.stateBox}>
          <MaterialIcons name="hourglass-empty" size={48} color={Colors.textMuted} />
        </View>
      ) : (
        teams.map((team) => (
          <Card
            key={team.id}
            style={styles.teamCard}
            onPress={() => router.push(`/(tabs)/planning/${team.id}`)}
          >
            <View style={styles.iconTile}>
              <MaterialIcons name="event-note" size={24} color={Colors.primary} />
            </View>
            <Text style={styles.teamName}>{team.name}</Text>
            <MaterialIcons name="chevron-right" size={26} color={Colors.textMuted} />
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: Spacing.xl,
    marginBottom: Spacing.md,
    gap: 2,
  },
  subtitle: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
  },
  title: {
    ...Typography.displayMedium,
    color: Colors.textPrimary,
  },
  accuracyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    backgroundColor: Colors.bgDark,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
    ...Shadows.md,
  },
  accuracyIconTile: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(123, 196, 168, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accuracyInfo: {
    flex: 1,
    gap: 3,
  },
  accuracyTitle: {
    fontFamily: Fonts.extraBold,
    fontSize: 15,
    lineHeight: 20,
    color: Colors.textOnDark,
  },
  accuracyDetail: {
    fontFamily: Fonts.medium,
    fontSize: 12.5,
    lineHeight: 17,
    color: 'rgba(246, 241, 233, 0.6)',
  },
  accuracyBig: {
    fontFamily: Fonts.extraBold,
    fontSize: 34,
    lineHeight: 40,
    color: Colors.secondaryLight,
    fontVariant: ['tabular-nums'],
  },
  stateBox: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xxxl,
    paddingHorizontal: Spacing.xl,
  },
  stateText: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    marginBottom: Spacing.lg,
    padding: Spacing.xl,
  },
  iconTile: {
    width: 46,
    height: 46,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamName: {
    ...Typography.headingMedium,
    color: Colors.textPrimary,
    flex: 1,
  },
});
