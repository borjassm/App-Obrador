import { useCallback, useEffect, useState } from 'react';

import {
  analyticsService,
  type DailyPoint,
  type FamilyRow,
  type Overview,
  type ProfitRow,
  type TopProduct,
  type WasteRow,
  type WeekdayRow,
} from '@/services/analytics.service';

export type Period = '7d' | '30d' | '90d' | '365d';

const PERIOD_DAYS: Record<Period, number> = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 };

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shiftDays(dateISO: string, days: number): string {
  const d = new Date(dateISO + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return iso(d);
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
  profit: ProfitRow[];
}

export function useAnalytics() {
  const [period, setPeriod] = useState<Period>('30d');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: Period) => {
    setLoading(true);
    try {
      const latest = await analyticsService.latestDates();
      const anchorSale = latest?.latest_sale ?? null;
      const anchorSession = latest?.latest_session ?? null;

      if (!anchorSale) {
        setData({
          anchorSale: null, anchorSession, overview: null, prevOverview: null,
          series: [], top: [], families: [], weekdays: [], waste: [], profit: [],
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

      const [overview, prevOverview, series, top, families, weekdays, waste, profit] =
        await Promise.all([
          analyticsService.overview(start, end),
          analyticsService.overview(prevStart, prevEnd),
          analyticsService.dailySeries(start, end),
          analyticsService.topProducts(start, end, 10),
          analyticsService.familyBreakdown(start, end),
          analyticsService.weekdayPattern(start, end),
          analyticsService.waste(wStart, wEnd, 10),
          analyticsService.profitability(start, end, 10),
        ]);

      setData({ anchorSale, anchorSession, overview, prevOverview, series, top, families, weekdays, waste, profit });
    } catch (e) {
      console.log('[useAnalytics] error:', e);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(period);
  }, [period, load]);

  return { period, setPeriod, data, loading, reload: () => load(period) };
}
