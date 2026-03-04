import { StyleSheet, Text, View } from 'react-native';

import Badge from '@/components/Badge';
import Card from '@/components/Card';
import FilterPills from '@/components/FilterPills';
import KPICard from '@/components/KPICard';
import SectionHeader from '@/components/SectionHeader';
import { Screen } from '@/components/Screen';
import { Colors, Radius, Spacing, Typography, getFamilyColor } from '@/constants/theme';
import { useOperationalData } from '@/hooks/useOperationalData';

const PERIOD_OPTIONS = [
  { key: '7d', label: 'Últimos 7 días' },
  { key: '30d', label: '30 días' },
  { key: '90d', label: '90 días' },
];

export default function DashboardTab() {
  const { summary, products, loading, period, setPeriod } = useOperationalData();

  if (loading) {
    return (
      <Screen>
        <View style={styles.loadingBox}>
          <Text style={styles.loadingText}>Cargando analítica…</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scrollable noPadding>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>📊 Analítica</Text>
        <Text style={styles.subtitle}>Datos reales de tus registros diarios</Text>
      </View>

      {/* Period filter */}
      <FilterPills options={PERIOD_OPTIONS} selected={period} onSelect={setPeriod} />

      {/* KPI grid */}
      <View style={styles.kpiGrid}>
        <KPICard
          label="Sobrantes"
          value={summary.totalSaved}
          unit="uds"
          color={Colors.primary}
        />
        <KPICard
          label="Descarte"
          value={summary.totalDiscarded}
          unit="uds"
          color={Colors.danger}
        />
      </View>

      <View style={styles.kpiGrid}>
        <KPICard
          label="% Merma"
          value={`${summary.wastePercent}%`}
          color={summary.wastePercent > 15 ? Colors.danger : summary.wastePercent > 8 ? Colors.warning : Colors.success}
          trend={
            summary.wastePercent > 15
              ? { direction: 'up', label: 'Alta' }
              : summary.wastePercent > 8
              ? { direction: 'flat', label: 'Media' }
              : { direction: 'down', label: 'Baja' }
          }
        />
        <KPICard
          label="Sesiones"
          value={summary.sessionsCount}
          color={Colors.secondary}
        />
      </View>

      {/* Product breakdown */}
      {products.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionPad}>
            <SectionHeader title="Detalle por producto" family="panaderia" />
          </View>

          {products.map((p) => {
            const familyColor = getFamilyColor(p.family);
            const wasteVariant: 'success' | 'warning' | 'danger' =
              p.wastePercent > 20 ? 'danger' :
              p.wastePercent > 10 ? 'warning' :
              'success';

            return (
              <View key={p.productId} style={styles.productRow}>
                <View style={[styles.familyBar, { backgroundColor: familyColor }]} />
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{p.productName}</Text>
                  <Text style={styles.productMeta}>
                    {p.daysRecorded} días · Prom. {p.avgSaved}/día
                  </Text>
                </View>
                <View style={styles.productStats}>
                  <Text style={styles.statSaved}>{p.totalSaved} sob.</Text>
                </View>
                <Badge
                  label={`${p.wastePercent}%`}
                  variant={wasteVariant}
                />
              </View>
            );
          })}
        </View>
      )}

      {products.length === 0 && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyEmoji}>📭</Text>
          <Text style={styles.emptyText}>No hay datos de registros para este periodo</Text>
          <Text style={styles.emptyHint}>Empieza registrando sobrantes en una ubicación</Text>
        </View>
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
  kpiGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
  },
  section: {
    marginTop: Spacing.xxl,
  },
  sectionPad: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    paddingVertical: Spacing.md,
    paddingRight: Spacing.lg,
    marginBottom: 1,
    gap: Spacing.md,
  },
  familyBar: {
    width: 4,
    height: '100%',
    minHeight: 48,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  productInfo: {
    flex: 1,
    gap: 2,
  },
  productName: {
    ...Typography.labelMedium,
    color: Colors.textPrimary,
  },
  productMeta: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
  productStats: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  statSaved: {
    ...Typography.bodySmall,
    color: Colors.primary,
    fontWeight: '600',
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
  },
  bottomPad: {
    height: Spacing.xxxl,
  },
});
