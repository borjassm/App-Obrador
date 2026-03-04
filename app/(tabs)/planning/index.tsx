import { StyleSheet, Text, View } from 'react-native';

import Badge from '@/components/Badge';
import Card from '@/components/Card';
import SectionHeader from '@/components/SectionHeader';
import { Screen } from '@/components/Screen';
import { Colors, Radius, Spacing, Typography, getFamilyColor } from '@/constants/theme';
import { usePlanningData } from '@/hooks/usePlanningData';

const CONFIDENCE_LABEL: Record<string, string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

const CONFIDENCE_VARIANT: Record<string, 'success' | 'warning' | 'neutral'> = {
  high: 'success',
  medium: 'warning',
  low: 'neutral',
};

export default function PlanningTab() {
  const { plans, loading } = usePlanningData();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  if (loading) {
    return (
      <Screen>
        <View style={styles.loadingBox}>
          <Text style={styles.loadingText}>Calculando planificación…</Text>
        </View>
      </Screen>
    );
  }

  // Group by family
  const grouped = new Map<string, typeof plans>();
  for (const plan of plans) {
    if (!grouped.has(plan.family)) grouped.set(plan.family, []);
    grouped.get(plan.family)!.push(plan);
  }

  return (
    <Screen scrollable noPadding>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>📋 Planificación</Text>
        <Text style={styles.subtitle}>Producción sugerida para mañana</Text>
        <View style={styles.datePill}>
          <Text style={styles.dateText}>{tomorrowStr}</Text>
        </View>
      </View>

      {plans.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyEmoji}>📭</Text>
          <Text style={styles.emptyText}>Sin datos suficientes para planificar</Text>
          <Text style={styles.emptyHint}>Registra sobrantes diarios y las sugerencias aparecerán aquí</Text>
        </View>
      ) : (
        [...grouped.entries()].map(([family, familyPlans]) => (
          <View key={family} style={styles.section}>
            <View style={styles.sectionPad}>
              <SectionHeader
                title={family.charAt(0).toUpperCase() + family.slice(1)}
                family={family}
              />
            </View>

            {familyPlans.map((plan) => {
              const familyColor = getFamilyColor(plan.family);
              return (
                <Card key={plan.productId} style={styles.planCard}>
                  <View style={styles.planHeader}>
                    <View style={[styles.familyDot, { backgroundColor: familyColor }]} />
                    <Text style={styles.productName}>{plan.productName}</Text>
                    <Badge
                      label={CONFIDENCE_LABEL[plan.confidence] ?? 'Baja'}
                      variant={CONFIDENCE_VARIANT[plan.confidence] ?? 'neutral'}
                    />
                  </View>

                  {/* Suggested qty - hero number */}
                  <View style={styles.suggestedRow}>
                    <Text style={[styles.suggestedNum, { color: familyColor }]}>
                      {plan.suggested}
                    </Text>
                    <Text style={styles.suggestedLabel}>uds sugeridas</Text>
                  </View>

                  {/* Context row */}
                  <View style={styles.contextRow}>
                    <View style={styles.contextItem}>
                      <Text style={styles.contextValue}>{plan.avgSaved7}</Text>
                      <Text style={styles.contextLabel}>Prom 7d</Text>
                    </View>
                    <View style={styles.contextDivider} />
                    <View style={styles.contextItem}>
                      <Text style={styles.contextValue}>{plan.avgSaved30}</Text>
                      <Text style={styles.contextLabel}>Prom 30d</Text>
                    </View>
                    <View style={styles.contextDivider} />
                    <View style={styles.contextItem}>
                      <Text style={[styles.contextValue, { color: Colors.danger }]}>
                        {plan.avgDiscarded7}
                      </Text>
                      <Text style={styles.contextLabel}>Merma 7d</Text>
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>
        ))
      )}

      <View style={styles.bottomPad} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
  },
  header: {
    padding: Spacing.lg,
    paddingTop: Spacing.xxl,
    gap: Spacing.xs,
  },
  title: {
    ...Typography.displayMedium,
    color: Colors.textPrimary,
  },
  subtitle: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
  },
  datePill: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.secondary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    marginTop: Spacing.sm,
  },
  dateText: {
    ...Typography.labelSmall,
    color: Colors.textOnPrimary,
    textTransform: 'capitalize',
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionPad: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  planCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  familyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  productName: {
    ...Typography.labelMedium,
    color: Colors.textPrimary,
    flex: 1,
  },
  suggestedRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  suggestedNum: {
    ...Typography.numberMedium,
  },
  suggestedLabel: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
  contextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgBase,
    borderRadius: Radius.sm,
    padding: Spacing.md,
  },
  contextItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  contextValue: {
    ...Typography.numberSmall,
    color: Colors.textPrimary,
  },
  contextLabel: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    fontSize: 11,
  },
  contextDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.divider,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    gap: Spacing.md,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyText: {
    ...Typography.bodyLarge,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  emptyHint: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  bottomPad: {
    height: Spacing.xxxl,
  },
});
