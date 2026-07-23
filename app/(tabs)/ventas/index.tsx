import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import Card from '@/components/Card';
import FilterPills from '@/components/FilterPills';
import KPICard from '@/components/KPICard';
import MiniBarChart, { type BarPoint } from '@/components/MiniBarChart';
import { Screen } from '@/components/Screen';
import {
  Colors,
  Spacing,
  TABLET_BREAKPOINT,
  Typography,
  getFamilyColor,
} from '@/constants/theme';
import { useSales, type QuickPeriod } from '@/hooks/useSales';

const PERIOD_OPTIONS: { key: QuickPeriod; label: string }[] = [
  { key: 'dia', label: 'Último día' },
  { key: 'semana', label: 'Semana' },
  { key: 'mes', label: 'Mes' },
  { key: 'anio', label: 'Año' },
  { key: 'todo', label: 'Todo' },
];

const VISIBLE_PRODUCTS = 15;

function euros(n: number): string {
  return n.toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €';
}

function deltaPct(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Marca la barra pico (máximo → espresso) y las destacadas (>= 75% del máximo → arena). */
function markEmphasis(points: BarPoint[]): BarPoint[] {
  const max = Math.max(...points.map((p) => p.value), 0);
  if (max <= 0) return points;
  let peakSet = false;
  return points.map((p) => {
    if (!peakSet && p.value === max) {
      peakSet = true;
      return { ...p, peak: true };
    }
    return { ...p, highlight: p.value >= max * 0.75 };
  });
}

/** Agrupa la serie diaria en ~30 barras máximo (por tramos si hace falta). */
function downsample(series: { sale_date: string; revenue: number }[]): BarPoint[] {
  if (series.length <= 31) {
    return series.map((p, i) => ({
      value: p.revenue,
      label:
        i % Math.ceil(series.length / 6) === 0
          ? p.sale_date.slice(8, 10) + '/' + p.sale_date.slice(5, 7)
          : undefined,
    }));
  }
  const bucketSize = Math.ceil(series.length / 30);
  const points: BarPoint[] = [];
  for (let i = 0; i < series.length; i += bucketSize) {
    const bucket = series.slice(i, i + bucketSize);
    points.push({
      value: bucket.reduce((s, p) => s + p.revenue, 0) / bucket.length,
      label:
        points.length % 5 === 0
          ? bucket[0].sale_date.slice(8, 10) + '/' + bucket[0].sale_date.slice(5, 7)
          : undefined,
    });
  }
  return points;
}

export default function VentasTab() {
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;
  const { period, setPeriod, locationId, setLocationId, locations, data, loading, periodLabel } =
    useSales();
  const [showAllProducts, setShowAllProducts] = useState(false);

  if (loading && !data) {
    return (
      <Screen>
        <View style={styles.loadingBox}>
          <Text style={styles.loadingText}>Cargando ventas…</Text>
        </View>
      </Screen>
    );
  }

  if (!data || !data.summary) {
    return (
      <Screen>
        <View style={styles.loadingBox}>
          <MaterialIcons name="inbox" size={48} color={Colors.textMuted} />
          <Text style={styles.loadingText}>Aún no hay ventas cargadas.</Text>
          <Text style={styles.emptyHint}>Importa las ventas del ERP desde Ajustes.</Text>
        </View>
      </Screen>
    );
  }

  const { summary, prevSummary, series, products } = data;
  const revDelta = prevSummary ? deltaPct(summary.total_revenue, prevSummary.total_revenue) : null;
  const unitsDelta = prevSummary ? deltaPct(summary.total_units, prevSummary.total_units) : null;
  const hasSales = summary.days_with_sales > 0;
  const visibleProducts = showAllProducts ? products : products.slice(0, VISIBLE_PRODUCTS);

  const locationOptions = [
    { key: 'all', label: 'Todas' },
    ...locations.map((l) => ({ key: l.id, label: l.shortName })),
  ];

  return (
    <Screen scrollable>
      <View style={styles.header}>
        <Text style={styles.title}>Ventas</Text>
        <Text style={styles.subtitle}>{periodLabel}</Text>
      </View>

      <View style={styles.filters}>
        <FilterPills
          options={PERIOD_OPTIONS}
          selected={period}
          onSelect={(k) => {
            setShowAllProducts(false);
            setPeriod(k as QuickPeriod);
          }}
        />
        <FilterPills
          options={locationOptions}
          selected={locationId}
          onSelect={(k) => {
            setShowAllProducts(false);
            setLocationId(k);
          }}
        />
      </View>

      {!hasSales ? (
        <View style={styles.loadingBox}>
          <MaterialIcons name="inbox" size={48} color={Colors.textMuted} />
          <Text style={styles.loadingText}>Sin ventas en este periodo.</Text>
        </View>
      ) : (
        <>
          <View style={styles.kpiGrid}>
            <KPICard
              label="Facturación"
              value={euros(summary.total_revenue)}
              trend={
                revDelta != null
                  ? {
                      direction: revDelta >= 0 ? 'up' : 'down',
                      label: `${revDelta >= 0 ? '+' : ''}${revDelta}% vs anterior`,
                    }
                  : undefined
              }
            />
            <KPICard
              label="Unidades"
              value={Math.round(summary.total_units).toLocaleString('es-ES')}
              trend={
                unitsDelta != null
                  ? {
                      direction: unitsDelta >= 0 ? 'up' : 'down',
                      label: `${unitsDelta >= 0 ? '+' : ''}${unitsDelta}%`,
                    }
                  : undefined
              }
            />
            {summary.days_with_sales > 1 && (
              <KPICard label="Media / día" value={euros(summary.avg_daily_revenue)} />
            )}
            <KPICard
              label="Productos"
              value={summary.active_products}
              unit={summary.days_with_sales > 1 ? `${summary.days_with_sales} días` : undefined}
            />
          </View>

          {series.length > 1 && (
            <Card style={styles.panelCard} shadow="sm">
              <Text style={styles.cardTitle}>Facturación por día</Text>
              <MiniBarChart
                points={markEmphasis(downsample(series))}
                height={isTablet ? 180 : 130}
              />
            </Card>
          )}

          <Card style={styles.panelCard} shadow="sm">
            <Text style={styles.cardTitle}>Productos del periodo</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.colRank]}>#</Text>
              <Text style={[styles.tableHeaderText, styles.colName]}>Producto</Text>
              <Text style={[styles.tableHeaderText, styles.colRevenue]}>Factur.</Text>
              <Text style={[styles.tableHeaderText, styles.colUnits]}>Uds</Text>
              {isTablet && <Text style={[styles.tableHeaderText, styles.colAvg]}>Uds/día</Text>}
            </View>
            {visibleProducts.map((p, i) => (
              <View key={p.product_id} style={[styles.productRow, i % 2 === 1 && styles.productRowAlt]}>
                <Text style={[styles.rankText, styles.colRank]}>{i + 1}</Text>
                <View style={[styles.nameCell, styles.colName]}>
                  <View style={[styles.familyDot, { backgroundColor: getFamilyColor(p.family) }]} />
                  <Text style={styles.nameText} numberOfLines={1}>
                    {p.name}
                  </Text>
                </View>
                <Text style={[styles.numText, styles.colRevenue]}>{euros(p.revenue)}</Text>
                <Text style={[styles.numText, styles.colUnits]}>
                  {Math.round(p.units).toLocaleString('es-ES')}
                </Text>
                {isTablet && (
                  <Text style={[styles.numTextMuted, styles.colAvg]}>
                    {p.avg_units_per_day.toLocaleString('es-ES')}
                  </Text>
                )}
              </View>
            ))}
            {products.length > VISIBLE_PRODUCTS && (
              <Pressable
                onPress={() => setShowAllProducts((v) => !v)}
                style={({ pressed }) => [styles.showMoreBtn, pressed && styles.pressed]}
              >
                <Text style={styles.showMoreText}>
                  {showAllProducts
                    ? 'Ver menos'
                    : `Ver todos (+${products.length - VISIBLE_PRODUCTS})`}
                </Text>
                <MaterialIcons
                  name={showAllProducts ? 'expand-less' : 'expand-more'}
                  size={20}
                  color={Colors.primary}
                />
              </Pressable>
            )}
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.displayMedium,
    color: Colors.textPrimary,
  },
  subtitle: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  filters: {
    marginBottom: Spacing.md,
  },
  loadingBox: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xxxl,
  },
  loadingText: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  emptyHint: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  panelCard: {
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  cardTitle: {
    ...Typography.headingMedium,
    color: Colors.textPrimary,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  tableHeaderText: {
    ...Typography.meta,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  colRank: { width: 26 },
  colName: { flex: 1 },
  colRevenue: { width: 86, textAlign: 'right' },
  colUnits: { width: 64, textAlign: 'right' },
  colAvg: { width: 64, textAlign: 'right' },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 44,
    paddingVertical: Spacing.xs,
  },
  productRowAlt: {
    backgroundColor: Colors.bgBase,
    borderRadius: 8,
  },
  rankText: {
    ...Typography.meta,
    fontVariant: ['tabular-nums'],
  },
  nameCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  familyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  nameText: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  numText: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  numTextMuted: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  showMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    minHeight: 44,
    marginTop: Spacing.xs,
  },
  showMoreText: {
    ...Typography.labelMedium,
    color: Colors.primary,
  },
  pressed: {
    opacity: 0.85,
  },
});
