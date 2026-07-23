import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import Card from '@/components/Card';
import FilterPills from '@/components/FilterPills';
import KPICard from '@/components/KPICard';
import MiniBarChart, { type BarPoint } from '@/components/MiniBarChart';
import { Screen } from '@/components/Screen';
import {
  Colors,
  Fonts,
  Radius,
  Spacing,
  TABLET_BREAKPOINT,
  Typography,
  getFamilyColor,
} from '@/constants/theme';
import { useAnalytics, type CompareMode, type Period } from '@/hooks/useAnalytics';
import { useLocations } from '@/hooks/useLocations';
import { analyticsService, type DailyPoint } from '@/services/analytics.service';
import { exportAnalyticsToExcel } from '@/services/export.service';

const PERIOD_OPTIONS: { key: Period; label: string }[] = [
  { key: '7d', label: '7 días' },
  { key: '30d', label: '30 días' },
  { key: '90d', label: '90 días' },
  { key: '365d', label: '1 año' },
];

const COMPARE_OPTIONS: { key: CompareMode; label: string }[] = [
  { key: 'none', label: 'Sin comparar' },
  { key: 'wow', label: 'Semana ant.' },
  { key: 'mom', label: 'Mes ant.' },
  { key: 'yoy', label: 'Año ant.' },
];

const COMPARE_LABEL: Record<Exclude<CompareMode, 'none'>, string> = {
  wow: 'la semana anterior',
  mom: 'el mes anterior',
  yoy: 'el año anterior',
};

type ExplorerMetric = 'revenue' | 'units' | 'waste';
type ExplorerGran = 'dia' | 'semana' | 'mes';

const METRIC_OPTIONS: { key: ExplorerMetric; label: string }[] = [
  { key: 'revenue', label: 'Facturación' },
  { key: 'units', label: 'Unidades' },
  { key: 'waste', label: 'Merma €' },
];

const GRAN_OPTIONS: { key: ExplorerGran; label: string }[] = [
  { key: 'dia', label: 'Día' },
  { key: 'semana', label: 'Semana' },
  { key: 'mes', label: 'Mes' },
];

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const WEEKDAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

type IconName = keyof typeof MaterialIcons.glyphMap;

interface Insight {
  icon: IconName;
  tileBg: string;
  iconColor: string;
  title: string;
  detail: string;
}

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

// Lunes de la semana de una fecha (clave de agrupación semanal)
function mondayOf(dateISO: string): string {
  const d = new Date(dateISO + 'T12:00:00');
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Serie del explorador agrupada por día/semana/mes, con etiquetas dispersas
function bucketExplorerSeries(
  rows: { date: string; value: number }[],
  gran: ExplorerGran
): BarPoint[] {
  if (gran === 'dia') {
    if (rows.length > 31) {
      const bucketSize = Math.ceil(rows.length / 30);
      const points: BarPoint[] = [];
      for (let i = 0; i < rows.length; i += bucketSize) {
        const bucket = rows.slice(i, i + bucketSize);
        points.push({
          value: bucket.reduce((s, r) => s + r.value, 0),
          label:
            points.length % 5 === 0
              ? bucket[0].date.slice(8, 10) + '/' + bucket[0].date.slice(5, 7)
              : undefined,
        });
      }
      return points;
    }
    const every = Math.max(1, Math.ceil(rows.length / 6));
    return rows.map((r, i) => ({
      value: r.value,
      label: i % every === 0 ? r.date.slice(8, 10) + '/' + r.date.slice(5, 7) : undefined,
    }));
  }

  const map = new Map<string, number>();
  for (const r of rows) {
    const key = gran === 'mes' ? r.date.slice(0, 7) : mondayOf(r.date);
    map.set(key, (map.get(key) ?? 0) + r.value);
  }
  const entries = [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  const every = Math.max(1, Math.ceil(entries.length / 8));
  return entries.map(([key, value], i) => ({
    value,
    label:
      i % every === 0
        ? gran === 'mes'
          ? MONTHS_SHORT[parseInt(key.slice(5, 7), 10) - 1]
          : key.slice(8, 10) + '/' + key.slice(5, 7)
        : undefined,
  }));
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
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;
  const {
    period,
    setPeriod,
    locationId,
    setLocationId,
    compareMode,
    setCompareMode,
    comparison,
    data,
    loading,
  } = useAnalytics();
  const locations = useLocations();

  // Explorador de gráficas
  const [metric, setMetric] = useState<ExplorerMetric>('revenue');
  const [granularity, setGranularity] = useState<ExplorerGran>('dia');
  const [explorerProduct, setExplorerProduct] = useState<string | 'all'>('all');
  const [productSeries, setProductSeries] = useState<DailyPoint[]>([]);
  const [exporting, setExporting] = useState(false);

  // Serie del producto elegido en el explorador (bajo demanda)
  useEffect(() => {
    if (explorerProduct === 'all' || !data?.periodStart) {
      setProductSeries([]);
      return;
    }
    let cancelled = false;
    analyticsService
      .productSeries(
        data.periodStart,
        data.periodEnd,
        explorerProduct,
        locationId === 'all' ? null : locationId
      )
      .then((rows) => {
        if (!cancelled) setProductSeries(rows);
      });
    return () => {
      cancelled = true;
    };
  }, [explorerProduct, data?.periodStart, data?.periodEnd, locationId]);

  // El producto seleccionado puede desaparecer del top al cambiar de periodo
  useEffect(() => {
    if (explorerProduct !== 'all' && data?.top && !data.top.some((p) => p.product_id === explorerProduct)) {
      setExplorerProduct('all');
    }
  }, [data?.top, explorerProduct]);

  const explorerPoints = useMemo<BarPoint[]>(() => {
    if (!data) return [];
    let rows: { date: string; value: number }[];
    if (metric === 'waste') {
      rows = data.wasteSeries.map((w) => ({ date: w.session_date, value: w.waste_cost }));
    } else {
      const source = explorerProduct === 'all' ? data.series : productSeries;
      rows = source.map((s) => ({
        date: s.sale_date,
        value: metric === 'revenue' ? s.revenue : s.units,
      }));
    }
    return markEmphasis(bucketExplorerSeries(rows, granularity));
  }, [data, metric, granularity, explorerProduct, productSeries]);

  const locationLabel =
    locationId === 'all'
      ? 'Todas'
      : locations.find((l) => l.id === locationId)?.shortName ?? 'Ubicación';

  const handleExport = async () => {
    if (!data) return;
    setExporting(true);
    try {
      await exportAnalyticsToExcel(data, locationLabel);
    } catch (e) {
      Alert.alert('Error al exportar', e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  };

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
          <MaterialIcons name="inbox" size={48} color={Colors.textMuted} />
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

  // Potenciales de mejora (calculados sobre los datos del periodo)
  const insights: Insight[] = [];
  if (data.waste[0]?.waste_cost > 0) {
    const w = data.waste[0];
    insights.push({
      icon: 'delete',
      tileBg: Colors.dangerLight,
      iconColor: Colors.danger,
      title: `Reducir la merma de ${w.name}`,
      detail: `Se tiraron ${Math.round(w.discarded)} uds (~${euros(w.waste_cost)} en coste, ${euros(w.lost_revenue)} en venta perdida). Es tu mayor fuga.`,
    });
  }
  if (data.profit[0]) {
    const p = data.profit[0];
    insights.push({
      icon: 'star',
      tileBg: Colors.successLight,
      iconColor: Colors.success,
      title: `Potencia ${p.name}`,
      detail: `Es tu producto más rentable: ${euros(p.est_margin)} de margen (${p.margin_pct}%) con ${Math.round(p.units)} uds. Dale visibilidad y no lo dejes agotarse.`,
    });
  }
  const lowMargin = [...data.profit].filter((p) => p.units > 50).sort((a, b) => a.margin_pct - b.margin_pct)[0];
  if (lowMargin && lowMargin.margin_pct < 60) {
    insights.push({
      icon: 'search',
      tileBg: Colors.warningLight,
      iconColor: Colors.warning,
      title: `Revisa el precio de ${lowMargin.name}`,
      detail: `Vende bien (${Math.round(lowMargin.units)} uds) pero su margen es de los más bajos (${lowMargin.margin_pct}%). Una pequeña subida o un ajuste de coste tendría impacto directo.`,
    });
  }
  if (bestDay && avgAllDays > 0) {
    const pct = Math.round(((bestDay.avg_revenue - avgAllDays) / avgAllDays) * 100);
    if (pct > 10) {
      insights.push({
        icon: 'calendar-month',
        tileBg: Colors.secondaryTint,
        iconColor: Colors.secondary,
        title: `El ${WEEKDAY_LABELS[bestDay.weekday].toLowerCase()} es tu mejor día`,
        detail: `Factura de media ${euros(bestDay.avg_revenue)} (+${pct}% sobre la media). Asegura producción y personal ese día.`,
      });
    }
  }

  const headerText = (
    <View style={styles.headerText}>
      <Text style={styles.title}>Analítica</Text>
      <Text style={styles.subtitle}>
        Ventas hasta {data.anchorSale.split('-').reverse().join('/')}
        {data.anchorSession ? ` · sobrantes hasta ${data.anchorSession.split('-').reverse().join('/')}` : ''}
      </Text>
    </View>
  );

  const kpiCards = [
    <KPICard
      key="rev"
      label="Ingresos"
      value={euros(overview.total_revenue)}
      trend={revDelta != null ? { direction: revDelta >= 0 ? 'up' : 'down', label: `${revDelta >= 0 ? '+' : ''}${revDelta}% vs anterior` } : undefined}
    />,
    <KPICard
      key="units"
      label="Unidades"
      value={Math.round(overview.total_units).toLocaleString('es-ES')}
      trend={unitsDelta != null ? { direction: unitsDelta >= 0 ? 'up' : 'down', label: `${unitsDelta >= 0 ? '+' : ''}${unitsDelta}%` } : undefined}
    />,
    <KPICard key="margin" label="Margen est." value={euros(totalMargin)} unit="top 10" color={Colors.success} />,
    <KPICard key="waste" label="Merma" value={euros(totalWasteCost)} unit="en coste" color={totalWasteCost > 0 ? Colors.danger : Colors.textMuted} />,
  ];

  const revenueChart = (
    <Card style={[styles.panelCard, isTablet && styles.panelLeft]} shadow="sm">
      <Text style={styles.cardTitle}>Ingresos por día</Text>
      <MiniBarChart points={markEmphasis(downsample(data.series))} height={isTablet ? 180 : 130} />
      <Text style={styles.chartCaption}>
        Media diaria: {euros(overview.avg_daily_revenue)} · {overview.days_with_sales} días con ventas
      </Text>
    </Card>
  );

  const insightsCard = (
    <Card style={[styles.panelCard, isTablet && styles.panelRight]} shadow="sm">
      <Text style={styles.cardTitle}>Potenciales de mejora</Text>
      {insights.length === 0 ? (
        <Text style={styles.insightEmpty}>Sin recomendaciones para este periodo.</Text>
      ) : (
        insights.map((ins, i) => (
          <View key={i} style={[styles.insightRow, i > 0 && styles.insightRowBorder]}>
            <View style={[styles.insightTile, { backgroundColor: ins.tileBg }]}>
              <MaterialIcons name={ins.icon} size={19} color={ins.iconColor} />
            </View>
            <View style={styles.insightBody}>
              <Text style={styles.insightTitle}>{ins.title}</Text>
              <Text style={styles.insightDetail}>{ins.detail}</Text>
            </View>
          </View>
        ))
      )}
    </Card>
  );

  return (
    <Screen scrollable noPadding>
      {/* Header: título + subtítulo fechas + segmented de periodos */}
      {isTablet ? (
        <View style={styles.headerRow}>
          {headerText}
          <FilterPills options={PERIOD_OPTIONS} selected={period} onSelect={(k) => setPeriod(k as Period)} />
        </View>
      ) : (
        <>
          <View style={styles.header}>{headerText}</View>
          <FilterPills options={PERIOD_OPTIONS} selected={period} onSelect={(k) => setPeriod(k as Period)} />
        </>
      )}

      {/* Ubicación + exportar */}
      <View style={styles.controlsRow}>
        <View style={styles.controlsPills}>
          <FilterPills
            options={[
              { key: 'all', label: 'Todas' },
              ...locations.map((l) => ({ key: l.id, label: l.shortName })),
            ]}
            selected={locationId}
            onSelect={setLocationId}
          />
        </View>
        <Pressable
          onPress={handleExport}
          disabled={exporting}
          style={({ pressed }) => [
            styles.exportBtn,
            pressed && styles.exportBtnPressed,
            exporting && styles.exportBtnDisabled,
          ]}
        >
          <MaterialIcons name="file-download" size={18} color={Colors.primary} />
          <Text style={styles.exportBtnText}>{exporting ? 'Exportando…' : 'Exportar'}</Text>
        </Pressable>
      </View>

      {/* KPIs: fila de 4 en tablet, 2×2 en móvil */}
      {isTablet ? (
        <View style={styles.kpiGrid}>{kpiCards}</View>
      ) : (
        <>
          <View style={styles.kpiGrid}>{kpiCards.slice(0, 2)}</View>
          <View style={styles.kpiGrid}>{kpiCards.slice(2)}</View>
        </>
      )}

      {/* Comparativa de calendario: semana / mes / año anterior */}
      <Card style={styles.sectionCard} shadow="sm">
        <Text style={styles.cardTitle}>Comparativa</Text>
        <FilterPills
          options={COMPARE_OPTIONS}
          selected={compareMode}
          onSelect={(k) => setCompareMode(k as CompareMode)}
        />
        {compareMode !== 'none' &&
          (comparison?.current && comparison?.previous ? (
            <>
              <Text style={styles.compareCaption}>
                {comparison.range.start.split('-').reverse().join('/')} –{' '}
                {comparison.range.end.split('-').reverse().join('/')} frente a{' '}
                {COMPARE_LABEL[compareMode]} (mismo tramo)
              </Text>
              <View style={styles.compareGrid}>
                {(
                  [
                    ['Facturación', comparison.current.total_revenue, comparison.previous.total_revenue, true],
                    ['Media/día', comparison.current.avg_daily_revenue, comparison.previous.avg_daily_revenue, true],
                    ['Unidades', comparison.current.total_units, comparison.previous.total_units, false],
                  ] as const
                ).map(([label, curr, prev, isMoney]) => {
                  const delta = deltaPct(curr, prev);
                  const fmt = (n: number) =>
                    isMoney ? euros(n) : Math.round(n).toLocaleString('es-ES');
                  return (
                    <View key={label} style={styles.compareStat}>
                      <Text style={styles.compareStatLabel}>{label}</Text>
                      <Text style={styles.compareStatValue}>{fmt(curr)}</Text>
                      <Text style={styles.compareStatPrev}>antes {fmt(prev)}</Text>
                      {delta != null && (
                        <Text
                          style={[
                            styles.compareStatDelta,
                            { color: delta >= 0 ? Colors.success : Colors.danger },
                          ]}
                        >
                          {delta >= 0 ? '+' : ''}
                          {delta}%
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
              {comparison.movers.length > 0 && (
                <>
                  <Text style={styles.compareMoversTitle}>Productos con mayor cambio</Text>
                  {comparison.movers.map((m, i) => (
                    <View key={m.product_id} style={[styles.listRow, i > 0 && styles.topRowBorder]}>
                      <View style={styles.listInfo}>
                        <Text style={styles.topNameFlex} numberOfLines={1}>{m.name}</Text>
                        <Text style={styles.listMeta}>
                          {euros(m.prevRevenue)} → {euros(m.currentRevenue)}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.moverPct,
                          { color: m.changePct >= 0 ? Colors.success : Colors.danger },
                        ]}
                      >
                        {m.changePct >= 0 ? '+' : ''}
                        {m.changePct}%
                      </Text>
                    </View>
                  ))}
                </>
              )}
            </>
          ) : (
            <Text style={styles.insightEmpty}>Calculando comparativa…</Text>
          ))}
      </Card>

      {/* Grid 3fr/2fr: ingresos por día + potenciales de mejora */}
      <View style={[styles.panelGrid, isTablet && styles.panelGridRow]}>
        {revenueChart}
        {insightsCard}
      </View>

      {/* Explorador de gráficas */}
      <Card style={styles.sectionCard} shadow="sm">
        <Text style={styles.cardTitle}>Explorador de gráficas</Text>
        <FilterPills
          options={METRIC_OPTIONS}
          selected={metric}
          onSelect={(k) => setMetric(k as ExplorerMetric)}
        />
        <FilterPills
          options={GRAN_OPTIONS}
          selected={granularity}
          onSelect={(k) => setGranularity(k as ExplorerGran)}
        />
        {metric !== 'waste' && data.top.length > 0 && (
          <FilterPills
            options={[
              { key: 'all', label: 'Todos' },
              ...data.top.map((p) => ({
                key: p.product_id,
                label: p.name.length > 16 ? p.name.slice(0, 15) + '…' : p.name,
              })),
            ]}
            selected={explorerProduct}
            onSelect={setExplorerProduct}
          />
        )}
        {explorerPoints.length > 0 ? (
          <MiniBarChart points={explorerPoints} height={isTablet ? 170 : 130} />
        ) : (
          <Text style={styles.insightEmpty}>Sin datos para esta combinación.</Text>
        )}
      </Card>

      {/* Top productos por ingresos */}
      <Card style={styles.sectionCard} shadow="sm">
        <Text style={styles.cardTitle}>Top productos por ingresos</Text>
        {data.top.map((p, i) => (
          <View key={p.product_id} style={[styles.topRow, i > 0 && styles.topRowBorder]}>
            <Text style={styles.rankNum}>{i + 1}</Text>
            {isTablet ? (
              <>
                <Text style={styles.topName} numberOfLines={1}>{p.name}</Text>
                <View style={styles.shareTrackFlex}>
                  <View style={[styles.shareFill, { width: `${Math.min(100, p.revenue_share * 4)}%`, backgroundColor: getFamilyColor(p.family) }]} />
                </View>
                <Text style={styles.topAmount}>{euros(p.revenue)}</Text>
                <Text style={styles.topShare}>{p.revenue_share}%</Text>
              </>
            ) : (
              <>
                <View style={styles.topInfo}>
                  <Text style={styles.topNameFlex} numberOfLines={1}>{p.name}</Text>
                  <View style={styles.shareTrack}>
                    <View style={[styles.shareFill, { width: `${Math.min(100, p.revenue_share * 4)}%`, backgroundColor: getFamilyColor(p.family) }]} />
                  </View>
                </View>
                <View style={styles.topStats}>
                  <Text style={styles.topAmount}>{euros(p.revenue)}</Text>
                  <Text style={styles.topShare}>{p.revenue_share}%</Text>
                </View>
              </>
            )}
          </View>
        ))}
      </Card>

      {/* Patrón semanal */}
      {wd.length > 0 && (
        <Card style={styles.sectionCard} shadow="sm">
          <Text style={styles.cardTitle}>Ventas por día de la semana</Text>
          <MiniBarChart
            height={110}
            points={[1, 2, 3, 4, 5, 6, 0].map((dowIdx) => {
              const row = wd.find((d) => d.weekday === dowIdx);
              return {
                value: row?.avg_revenue ?? 0,
                label: WEEKDAY_LABELS[dowIdx],
                peak: bestDay?.weekday === dowIdx,
              };
            })}
          />
          {bestDay && (
            <Text style={styles.chartCaption}>
              Mejor día: {WEEKDAY_LABELS[bestDay.weekday]} ({euros(bestDay.avg_revenue)} de media)
            </Text>
          )}
        </Card>
      )}

      {/* Rentabilidad */}
      {data.profit.length > 0 && (
        <Card style={styles.sectionCard} shadow="sm">
          <Text style={styles.cardTitle}>Rentabilidad (productos con coste)</Text>
          {data.profit.map((p, i) => (
            <View key={p.product_id} style={[styles.listRow, i > 0 && styles.topRowBorder]}>
              <View style={styles.listInfo}>
                <Text style={styles.topNameFlex} numberOfLines={1}>{p.name}</Text>
                <Text style={styles.listMeta}>{Math.round(p.units)} uds · coste {p.unit_cost.toFixed(2)} €</Text>
              </View>
              <View style={styles.topStats}>
                <Text style={[styles.topAmount, { color: Colors.success }]}>{euros(p.est_margin)}</Text>
                <Text style={styles.topShare}>{p.margin_pct}% margen</Text>
              </View>
            </View>
          ))}
        </Card>
      )}

      {/* Mermas */}
      {data.waste.length > 0 && (
        <Card style={styles.sectionCard} shadow="sm">
          <Text style={styles.cardTitle}>Mermas por producto (€)</Text>
          {data.waste.map((w, i) => (
            <View key={w.product_id} style={[styles.listRow, i > 0 && styles.topRowBorder]}>
              <View style={styles.listInfo}>
                <Text style={styles.topNameFlex} numberOfLines={1}>{w.name}</Text>
                <Text style={styles.listMeta}>{Math.round(w.discarded)} tiradas · {Math.round(w.saved)} guardadas</Text>
              </View>
              <View style={styles.topStats}>
                <Text style={[styles.topAmount, { color: Colors.danger }]}>-{euros(w.waste_cost)}</Text>
                <Text style={styles.topShare}>venta perdida {euros(w.lost_revenue)}</Text>
              </View>
            </View>
          ))}
        </Card>
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
  emptyHint: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },

  // Header
  header: {
    padding: Spacing.lg,
    paddingTop: Spacing.xxl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: Spacing.lg,
    paddingTop: Spacing.xxl,
  },
  headerText: {
    gap: Spacing.xs,
    flexShrink: 1,
  },
  title: {
    ...Typography.displayMedium,
    color: Colors.textPrimary,
  },
  subtitle: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },

  // KPIs
  kpiGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
  },

  // Ubicación + exportar
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: Spacing.lg,
  },
  controlsPills: {
    flex: 1,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    minHeight: 44,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  exportBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  exportBtnDisabled: {
    opacity: 0.4,
  },
  exportBtnText: {
    ...Typography.labelMedium,
    fontSize: 13,
    color: Colors.primary,
  },

  // Comparativa
  compareCaption: {
    ...Typography.meta,
    fontVariant: ['tabular-nums'],
  },
  compareGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  compareStat: {
    flex: 1,
    minWidth: 120,
    gap: 2,
    backgroundColor: Colors.bgBase,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  compareStatLabel: {
    fontFamily: Fonts.bold,
    fontSize: 12.5,
    lineHeight: 17,
    color: Colors.textMuted,
  },
  compareStatValue: {
    ...Typography.numberSmall,
    color: Colors.textPrimary,
  },
  compareStatPrev: {
    ...Typography.meta,
    fontVariant: ['tabular-nums'],
  },
  compareStatDelta: {
    fontFamily: Fonts.extraBold,
    fontSize: 13,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
  },
  compareMoversTitle: {
    ...Typography.sectionLabel,
    marginTop: Spacing.sm,
  },
  moverPct: {
    fontFamily: Fonts.extraBold,
    fontSize: 14,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },

  // Grid de paneles (3fr / 2fr en tablet)
  panelGrid: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    gap: Spacing.md,
  },
  panelGridRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  panelCard: {
    padding: Spacing.xl,
    borderRadius: Radius.lg,
    gap: Spacing.md,
  },
  panelLeft: {
    flex: 3,
  },
  panelRight: {
    flex: 2,
  },
  cardTitle: {
    ...Typography.headingMedium,
    color: Colors.textPrimary,
  },
  chartCaption: {
    ...Typography.meta,
    textAlign: 'center',
  },

  // Potenciales de mejora
  insightRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'flex-start',
    paddingTop: Spacing.md,
  },
  insightRowBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    marginTop: Spacing.md,
  },
  insightTile: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightBody: {
    flex: 1,
    gap: 2,
  },
  insightTitle: {
    fontFamily: Fonts.extraBold,
    fontSize: 13.5,
    lineHeight: 18,
    color: Colors.textPrimary,
  },
  insightDetail: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textSecondary,
  },
  insightEmpty: {
    ...Typography.meta,
  },

  // Cards de sección (top productos, semanal, rentabilidad, mermas)
  sectionCard: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    padding: Spacing.xl,
    borderRadius: Radius.lg,
    gap: Spacing.md,
  },

  // Top productos
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingTop: Spacing.sm,
    minHeight: 40,
  },
  topRowBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    marginTop: Spacing.sm,
  },
  rankNum: {
    fontFamily: Fonts.extraBold,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textMuted,
    width: 22,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  topName: {
    ...Typography.bodyMedium,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    width: 210,
  },
  topNameFlex: {
    ...Typography.bodyMedium,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
  },
  topInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  shareTrack: {
    height: 10,
    backgroundColor: Colors.divider,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  shareTrackFlex: {
    flex: 1,
    height: 10,
    backgroundColor: Colors.divider,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  shareFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  topAmount: {
    fontFamily: Fonts.extraBold,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
    minWidth: 76,
  },
  topShare: {
    ...Typography.meta,
    textAlign: 'right',
    minWidth: 40,
  },
  topStats: {
    alignItems: 'flex-end',
    gap: 2,
  },

  // Listas (rentabilidad / mermas)
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingTop: Spacing.sm,
    minHeight: 44,
  },
  listInfo: {
    flex: 1,
    gap: 2,
  },
  listMeta: {
    ...Typography.meta,
  },

  bottomPad: {
    height: Spacing.xxxl,
  },
});
