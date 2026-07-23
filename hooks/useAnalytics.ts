import { useCallback, useEffect, useState } from 'react';

import { getPeriodRange, type PeriodRange } from '@/hooks/useSales';
import {
  analyticsService,
  type DailyPoint,
  type FamilyRow,
  type Overview,
  type ProfitRow,
  type TopProduct,
  type WastePoint,
  type WasteRow,
  type WeekdayRow,
} from '@/services/analytics.service';

export type Period = '7d' | '30d' | '90d' | '365d';

// Comparativas de calendario: semana / mes / año anterior (ancladas al último
// día con ventas; reutilizan los rangos ya probados de useSales)
export type CompareMode = 'none' | 'wow' | 'mom' | 'yoy';

const PERIOD_DAYS: Record<Period, number> = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 };

const COMPARE_TO_QUICK = { wow: 'semana', mom: 'mes', yoy: 'anio' } as const;

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shiftDays(dateISO: string, days: number): string {
  const d = new Date(dateISO + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return iso(d);
}

export interface ProductMover {
  product_id: string;
  name: string;
  family: string;
  currentRevenue: number;
  prevRevenue: number;
  changePct: number;
}

export interface ComparisonData {
  range: PeriodRange;
  current: Overview | null;
  previous: Overview | null;
  movers: ProductMover[];
}

export interface AnalyticsData {
  anchorSale: string | null;      // última fecha con ventas (ancla del periodo)
  anchorSession: string | null;   // última fecha con registro de sobrantes
  overview: Overview | null;
  prevOverview: Overview | null;  // periodo anterior equivalente (para deltas)
  series: DailyPoint[];
  top: TopProduct[];
  families: FamilyRow[];
  weekdays: WeekdayRow[];
  waste: WasteRow[];
  wasteSeries: WastePoint[];
  profit: ProfitRow[];
  periodStart: string;
  periodEnd: string;
}

function safePct(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function computeMovers(current: TopProduct[], previous: TopProduct[]): ProductMover[] {
  const prevMap = new Map(previous.map((p) => [p.product_id, p]));
  const seen = new Set<string>();
  const movers: ProductMover[] = [];
  for (const p of current) {
    seen.add(p.product_id);
    const prev = prevMap.get(p.product_id);
    movers.push({
      product_id: p.product_id,
      name: p.name,
      family: p.family,
      currentRevenue: p.revenue,
      prevRevenue: prev?.revenue ?? 0,
      changePct: safePct(p.revenue, prev?.revenue ?? 0),
    });
  }
  for (const p of previous) {
    if (seen.has(p.product_id)) continue;
    movers.push({
      product_id: p.product_id,
      name: p.name,
      family: p.family,
      currentRevenue: 0,
      prevRevenue: p.revenue,
      changePct: -100,
    });
  }
  // Solo movimientos con volumen relevante, ordenados por cambio absoluto
  return movers
    .filter((m) => m.currentRevenue + m.prevRevenue >= 100)
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    .slice(0, 5);
}

export function useAnalytics() {
  const [period, setPeriod] = useState<Period>('30d');
  const [locationId, setLocationId] = useState<string | 'all'>('all');
  const [compareMode, setCompareMode] = useState<CompareMode>('none');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: Period, locId: string | 'all') => {
    setLoading(true);
    try {
      const loc = locId === 'all' ? null : locId;
      const latest = await analyticsService.latestDates();
      const anchorSale = latest?.latest_sale ?? null;
      const anchorSession = latest?.latest_session ?? null;

      if (!anchorSale) {
        setData({
          anchorSale: null, anchorSession, overview: null, prevOverview: null,
          series: [], top: [], families: [], weekdays: [], waste: [], wasteSeries: [], profit: [],
          periodStart: '', periodEnd: '',
        });
        return;
      }

      const days = PERIOD_DAYS[p];
      const end = anchorSale;
      const start = shiftDays(end, -(days - 1));
      const prevEnd = shiftDays(start, -1);
      const prevStart = shiftDays(prevEnd, -(days - 1));

      // La merma se ancla a la última sesión registrada (puede ser otro rango de fechas)
      const wEnd = anchorSession ?? end;
      const wStart = shiftDays(wEnd, -(days - 1));

      const [overview, prevOverview, series, top, families, weekdays, waste, wasteSeries, profit] =
        await Promise.all([
          analyticsService.overview(start, end, loc),
          analyticsService.overview(prevStart, prevEnd, loc),
          analyticsService.dailySeries(start, end, loc),
          analyticsService.topProducts(start, end, 10, loc),
          analyticsService.familyBreakdown(start, end, loc),
          analyticsService.weekdayPattern(start, end, loc),
          analyticsService.waste(wStart, wEnd, 10, loc),
          analyticsService.wasteSeries(wStart, wEnd, loc),
          analyticsService.profitability(start, end, 10, loc),
        ]);

      setData({
        anchorSale, anchorSession, overview, prevOverview, series, top, families,
        weekdays, waste, wasteSeries, profit, periodStart: start, periodEnd: end,
      });
    } catch (e) {
      console.log('[useAnalytics] error:', e);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(period, locationId);
  }, [period, locationId, load]);

  // Comparativa de calendario (se carga aparte al elegir el modo)
  useEffect(() => {
    if (compareMode === 'none' || !data?.anchorSale) {
      setComparison(null);
      return;
    }
    const anchor = data.anchorSale;
    const loc = locationId === 'all' ? null : locationId;
    const range = getPeriodRange(COMPARE_TO_QUICK[compareMode], anchor, anchor);
    if (!range.prevStart || !range.prevEnd) {
      setComparison(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const [current, previous, topCurrent, topPrev] = await Promise.all([
        analyticsService.overview(range.start, range.end, loc),
        analyticsService.overview(range.prevStart!, range.prevEnd!, loc),
        analyticsService.topProducts(range.start, range.end, 200, loc),
        analyticsService.topProducts(range.prevStart!, range.prevEnd!, 200, loc),
      ]);
      if (!cancelled) {
        setComparison({ range, current, previous, movers: computeMovers(topCurrent, topPrev) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [compareMode, locationId, data?.anchorSale]);

  return {
    period,
    setPeriod,
    locationId,
    setLocationId,
    compareMode,
    setCompareMode,
    comparison,
    data,
    loading,
    reload: () => load(period, locationId),
  };
}
