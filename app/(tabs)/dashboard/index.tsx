import { StyleSheet, Text, View } from 'react-native';

import Card from '@/components/Card';
import FilterPills from '@/components/FilterPills';
import KPICard from '@/components/KPICard';
import MiniBarChart, { type BarPoint } from '@/components/MiniBarChart';
import SectionHeader from '@/components/SectionHeader';
import { Screen } from '@/components/Screen';
import { Colors, Radius, Spacing, Typography, getFamilyColor } from '@/constants/theme';
import { useAnalytics, type Period } from '@/hooks/useAnalytics';

const PERIOD_OPTIONS: { key: Period; label: string }[] = [
  { key: '7d', label: '7 días' },
  { key: '30d', label: '30 días' },
  { key: '90d', label: '90 días' },
  { key: '365d', label: '1 año' },
];

const WEEKDAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function euros(n: number): string {
  return n.toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €';
}

function deltaPct(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Agrupa la serie diaria en ~30 barras máximo (por semanas si hace falta). */
function downsample(series: { sale_date: string; revenue: number }[]): BarPoint[] {
  if (series.length <= 31) {
    return series.map((p, i) => ({
      value: p.revenue,
      label: i % Math.ceil(series.length / 6) === 0 ? p.sale_date.slice(8, 10) + '/' + p.sale_date.slice(5, 7) : undefined,
    }));
  }
  const bucketSize = Math.ceil(series.length / 30);
  const points: BarPoint[] = [];
  for (let i = 0; i < series.length; i += bucketSize) {
    const bucket = series.slice(i, i + bucketSize);
    points.push({
      value: bucket.reduce((s, p) => s + p.revenue, 0) / bucket.length,
      label: points.length % 5 === 0 ? bucket[0].sale_date.slice(8, 10) + '/' + bucket[0].sale_date.slice(5, 7) : undefined,
    });
  }
  return points;
}

export default function DashboardTab() {
  const { period, setPeriod, data, loading } = useAnalytics();

  if (loading) {
    return (
      <Screen>
        <View style={styles.loadingBox}>
          <Text style={styles.loadingText}>Analizando tus datos…</Text>
        </View>
      </Screen>
    );
  }

  if (!data || !data.anchorSale || !data.overview) {
    return (
      <Screen>
        <View style={styles.loadingBox}>
          <Text style={styles.emptyEmoji}>📭</Text>
          <Text style={styles.loadingText}>Aún no hay ventas cargadas.</Text>
          <Text style={styles.emptyHint}>Importa las ventas del ERP desde Ajustes.</Text>
        </View>
      </Screen>
    );
  }

  const { overview, prevOverview } = data;
  const revDelta = prevOverview ? deltaPct(overview.total_revenue, prevOverview.total_revenue) : null;
  const unitsDelta = prevOverview ? deltaPct(overview.total_units, prevOverview.total_units) : null;

  const totalWasteCost = data.waste.reduce((s, w) => s + w.waste_cost, 0);
  const totalMargin = data.profit.reduce((s, p) => s + p.est_margin, 0);

  // Patrón semanal → mejor y peor día
  const wd = data.weekdays;
  const bestDay = wd.length ? wd.reduce((a, b) => (b.avg_revenue > a.avg_revenue ? b : a)) : null;
  const avgAllDays = wd.length ? wd.reduce((s, d) => s + d.avg_revenue, 0) / wd.length : 0;

  // 💡 Potenciales de mejora (calculados sobre los datos del periodo)
  const insights: { emoji: string; title: string; detail: string }[] = [];
  if (data.waste[0]?.waste_cost > 0) {
    const w = data.waste[0];
    insights.push({
      emoji: '🗑️',
      title: `Reducir la merma de ${w.name}`,
      detail: `Se tiraron ${Math.round(w.discarded)} uds (~${euros(w.waste_cost)} en coste, ${euros(w.lost_revenue)} en venta perdida). Es tu mayor fuga.`,
    });
  }
  if (data.profit[0]) {
    const p = data.profit[0];
    insights.push({
      emoji: '⭐',
      title: `Potencia ${p.name}`,
      detail: `Es tu producto más rentable: ${euros(p.est_margin)} de margen (${p.margin_pct}%) con ${Math.round(p.units)} uds. Dale visibilidad y no lo dejes agotarse.`,
    });
  }
  const lowMargin = [...data.profit].filter((p) => p.units > 50).sort((a, b) => a.margin_pct - b.margin_pct)[0];
  if (lowMargin && lowMargin.margin_pct < 60) {
    insights.push({
      emoji: '🔍',
      title: `Revisa el precio de ${lowMargin.name}`,
      detail: `Vende bien (${Math.round(lowMargin.units)} uds) pero su margen es de los más bajos (${lowMargin.margin_pct}%). Una pequeña subida o un ajuste de coste tendría impacto directo.`,
    });
  }
  if (bestDay && avgAllDays > 0) {
    const pct = Math.round(((bestDay.avg_revenue - avgAllDays) / avgAllDays) * 100);
    if (pct > 10) {
      insights.push({
        emoji: '📅',
        title: `El ${WEEKDAY_LABELS[bestDay.weekday].toLowerCase()} es tu mejor día`,
        detail: `Factura de media ${euros(bestDay.avg_revenue)} (+${pct}% sobre la media). Asegura producción y personal ese día.`,
      });
    }
  }

  return (
    <Screen scrollable noPadding>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>📊 Analítica</Text>
        <Text style={styles.subtitle}>
          Ventas hasta {data.anchorSale.split('-').reverse().join('/')}
          {data.anchorSession ? ` · sobrantes hasta ${data.anchorSession.split('-').reverse().join('/')}` : ''}
        </Text>
      </View>

      <FilterPills options={PERIOD_OPTIONS} selected={period} onSelect={(k) => setPeriod(k as Period)} />

      {/* KPIs */}
      <View style={styles.kpiGrid}>
        <KPICard
          label="Ingresos"
          value={euros(overview.total_revenue)}
          color={Colors.primary}
          trend={revDelta != null ? { direction: revDelta >= 0 ? 'up' : 'down', label: `${revDelta >= 0 ? '+' : ''}${revDelta}% vs anterior` } : undefined}
        />
        <KPICard
          label="Unidades"
          value={Math.round(overview.total_units).toLocaleString('es-ES')}
          color={Colors.secondary}
          trend={unitsDelta != null ? { direction: unitsDelta >= 0 ? 'up' : 'down', label: `${unitsDelta >= 0 ? '+' : ''}${unitsDelta}%` } : undefined}
        />
      </View>
      <View style={styles.kpiGrid}>
        <KPICard label="Margen est." value={euros(totalMargin)} unit="top 10" color={Colors.success} />
        <KPICard label="Merma" value={euros(totalWasteCost)} unit="en coste" color={totalWasteCost > 0 ? Colors.danger : Colors.textMuted} />
      </View>

      {/* Tendencia de ingresos */}
      <View style={styles.section}>
        <View style={styles.sectionPad}>
          <SectionHeader title="Ingresos por día" family="panaderia" />
        </View>
        <Card style={styles.chartCard} shadow="sm">
          <MiniBarChart points={downsample(data.series)} height={130} />
          <Text style={styles.chartCaption}>
            Media diaria: {euros(overview.avg_daily_revenue)} · {overview.days_with_sales} días con ventas
          </Text>
        </Card>
      </View>

      {/* 💡 Potenciales de mejora */}
      {insights.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionPad}>
            <SectionHeader title="💡 Potenciales de mejora" family="laminado" />
          </View>
          <View style={styles.insightList}>
            {insights.map((ins, i) => (
              <Card key={i} style={styles.insightCard} shadow="sm">
                <Text style={styles.insightEmoji}>{ins.emoji}</Text>
                <View style={styles.insightBody}>
                  <Text style={styles.insightTitle}>{ins.title}</Text>
                  <Text style={styles.insightDetail}>{ins.detail}</Text>
                </View>
              </Card>
            ))}
          </View>
        </View>
      )}

      {/* Top productos */}
      <View style={styles.section}>
        <View style={styles.sectionPad}>
          <SectionHeader title="Top productos por ingresos" family="panaderia" />
        </View>
        {data.top.map((p, i) => (
          <View key={p.product_id} style={styles.rankRow}>
            <Text style={styles.rankNum}>{i + 1}</Text>
            <View style={styles.rankInfo}>
              <Text style={styles.rankName} numberOfLines={1}>{p.name}</Text>
              <View style={styles.shareTrack}>
                <View style={[styles.shareFill, { width: `${Math.min(100, p.revenue_share * 4)}%`, backgroundColor: getFamilyColor(p.family) }]} />
              </View>
            </View>
            <View style={styles.rankStats}>
              <Text style={styles.rankRevenue}>{euros(p.revenue)}</Text>
              <Text style={styles.rankUnits}>{Math.round(p.units).toLocaleString('es-ES')} uds · {p.revenue_share}%</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Patrón semanal */}
      {wd.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionPad}>
            <SectionHeader title="Ventas por día de la semana" family="laminado" />
          </View>
          <Card style={styles.chartCard} shadow="sm">
            <MiniBarChart
              height={110}
              points={[1, 2, 3, 4, 5, 6, 0].map((dowIdx) => {
                const row = wd.find((d) => d.weekday === dowIdx);
                return {
                  value: row?.avg_revenue ?? 0,
                  label: WEEKDAY_LABELS[dowIdx],
                  highlight: bestDay?.weekday === dowIdx,
                };
              })}
            />
            {bestDay && (
              <Text style={styles.chartCaption}>
                Mejor día: {WEEKDAY_LABELS[bestDay.weekday]} ({euros(bestDay.avg_revenue)} de media)
              </Text>
            )}
          </Card>
        </View>
      )}

      {/* Rentabilidad */}
      {data.profit.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionPad}>
            <SectionHeader title="Rentabilidad (productos con coste)" family="panaderia" />
          </View>
          {data.profit.map((p) => (
            <View key={p.product_id} style={styles.rankRow}>
              <View style={styles.rankInfo}>
                <Text style={styles.rankName} numberOfLines={1}>{p.name}</Text>
                <Text style={styles.rankUnits}>{Math.round(p.units)} uds · coste {p.unit_cost.toFixed(2)} €</Text>
              </View>
              <View style={styles.rankStats}>
                <Text style={[styles.rankRevenue, { color: Colors.success }]}>{euros(p.est_margin)}</Text>
                <Text style={styles.rankUnits}>{p.margin_pct}% margen</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Mermas */}
      {data.waste.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionPad}>
            <SectionHeader title="Mermas por producto (€)" family="navidad" />
          </View>
          {data.waste.map((w) => (
            <View key={w.product_id} style={styles.rankRow}>
              <View style={styles.rankInfo}>
                <Text style={styles.rankName} numberOfLines={1}>{w.name}</Text>
                <Text style={styles.rankUnits}>{Math.round(w.discarded)} tiradas · {Math.round(w.saved)} guardadas</Text>
              </View>
              <View style={styles.rankStats}>
                <Text style={[styles.rankRevenue, { color: Colors.danger }]}>-{euros(w.waste_cost)}</Text>
                <Text style={styles.rankUnits}>venta perdida {euros(w.lost_revenue)}</Text>
              </View>
            </View>
          ))}
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
    gap: Spacing.md,
  },
  loadingText: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyHint: {
    ...Typography.bodySmall,
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
    ...Typography.bodySmall,
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
  chartCard: {
    marginHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  chartCaption: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  insightList: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  insightCard: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'flex-start',
  },
  insightEmoji: {
    fontSize: 28,
  },
  insightBody: {
    flex: 1,
    gap: 2,
  },
  insightTitle: {
    ...Typography.labelMedium,
    color: Colors.textPrimary,
  },
  insightDetail: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: 1,
    gap: Spacing.md,
  },
  rankNum: {
    ...Typography.numberSmall,
    color: Colors.textMuted,
    width: 26,
    textAlign: 'center',
  },
  rankInfo: {
    flex: 1,
    gap: 4,
  },
  rankName: {
    ...Typography.labelMedium,
    color: Colors.textPrimary,
  },
  shareTrack: {
    height: 6,
    backgroundColor: Colors.borderLight,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  shareFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  rankStats: {
    alignItems: 'flex-end',
    gap: 2,
  },
  rankRevenue: {
    ...Typography.labelMedium,
    color: Colors.primary,
  },
  rankUnits: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    fontSize: 11,
  },
  bottomPad: {
    height: Spacing.xxxl,
  },
});
