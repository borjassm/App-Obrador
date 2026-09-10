import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';

import Card from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { teamsService, type Team } from '@/services/teams.service';

// Icono y color por equipo (los nombres vienen de production_teams)
function teamVisual(name: string): { icon: React.ReactNode; tint: string } {
  switch (name.toLowerCase()) {
    case 'panadería':
      return {
        icon: <MaterialCommunityIcons name="bread-slice-outline" size={26} color={Colors.primary} />,
        tint: Colors.primaryTint,
      };
    case 'pastelería':
      return { icon: <MaterialIcons name="cake" size={26} color={Colors.secondary} />, tint: Colors.secondaryTint };
    case 'laminado':
      return { icon: <MaterialIcons name="layers" size={26} color={Colors.primary} />, tint: Colors.primaryTint };
    case 'horno':
      return {
        icon: <MaterialIcons name="local-fire-department" size={26} color={Colors.danger} />,
        tint: Colors.dangerLight,
      };
    case 'cocina':
      return { icon: <MaterialIcons name="restaurant" size={26} color={Colors.secondary} />, tint: Colors.secondaryTint };
    default:
      return { icon: <MaterialIcons name="groups" size={26} color={Colors.primary} />, tint: Colors.primaryTint };
  }
}

export default function ObradorTeamsScreen() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      teamsService.listTeams().then((data) => {
        setTeams(data);
        setLoading(false);
      });
    }, [])
  );

  return (
    <Screen scrollable>
      <View style={styles.header}>
        <Text style={styles.title}>Obrador</Text>
        <Text style={styles.subtitle}>Elige tu equipo para ver el trabajo del día</Text>
      </View>

      {loading ? (
        <View style={styles.stateBox}>
          <MaterialIcons name="hourglass-empty" size={48} color={Colors.textMuted} />
        </View>
      ) : (
        teams.map((team) => {
          const visual = teamVisual(team.name);
          return (
            <Card
              key={team.id}
              style={styles.teamCard}
              onPress={() => router.push(`/(tabs)/obrador/${team.id}`)}
            >
              <View style={[styles.iconTile, { backgroundColor: visual.tint }]}>{visual.icon}</View>
              <Text style={styles.teamName}>{team.name}</Text>
              <MaterialIcons name="chevron-right" size={26} color={Colors.textMuted} />
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: Spacing.xl,
    marginBottom: Spacing.xl,
    gap: 2,
  },
  title: {
    ...Typography.displayMedium,
    color: Colors.textPrimary,
  },
  subtitle: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
  },
  stateBox: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
  },
  teamCard: {
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
  teamName: {
    ...Typography.headingMedium,
    color: Colors.textPrimary,
    flex: 1,
  },
});
