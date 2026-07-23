import { useCallback, useEffect, useMemo, useState } from 'react';

import { isNavidadSeason } from '@/constants/families';
import { applyFamilySubstitution } from '@/features/planning/familySubstitution';
import {
  addDays,
  getPhaseAssignments,
  isoLocal,
  PHASE_ORDER,
  type Phase,
} from '@/features/planning/pipelineScheduler';
import { holidayAdjustmentFactor, type HolidayAdjustment } from '@/features/planning/holidays';
import { supabase } from '@/lib/supabase';
import { analyticsService } from '@/services/analytics.service';
import {
  planningService,
  type AccuracyStats,
  type Suggestion,
} from '@/services/planning.service';
import {
  weatherAdjustmentFactor,
  weatherService,
  type ForecastDay,
} from '@/services/weather.service';

const DEFAULT_PROCESS_DAYS = 2;

export interface PipelineItem {
  productId: string;
  name: string;
  family: string;
  processDays: number;
  phase: Phase;
  sellDate: string;
  daysUntilSale: number;
  /** Sugerencia del motor SQL (sin factores) */
  baseQty: number;
  weatherFactor: number;
  holidayFactor: number;
  /** Sugerencia final = base × clima × festivo */
  suggestedQty: number;
  overrideQty: number | null;
  effectiveQty: number;
  naveQty: number;
  tiendaQty: number;
  confidence: string;
  baseRecent: number;
  baseHist: number;
  carryover: number;
  familyAdjusted: boolean;
}

export interface PipelineSummary {
  totalProducts: number;
  totalUnits: number;
  unitsByPhase: Record<Phase, number>;
  overrideCount: number;
}

export interface WeatherInfo {
  day: ForecastDay;
  factor: number;
}

interface FetchState {
  suggestionsByDate: Record<string, Suggestion[]>;
  processDays: Map<string, number>;
  naveShare: Map<string, number>;
  forecast: ForecastDay[];
  accuracy: AccuracyStats | null;
}

function splitByLocation(qty: number, naveShare: number): { naveQty: number; tiendaQty: number } {
  const naveQty = Math.round(qty * naveShare);
  return { naveQty, tiendaQty: qty - naveQty };
}

export function usePipelinePlanning() {
  const todayISO = useMemo(() => isoLocal(new Date()), []);
  const today = useMemo(() => new Date(todayISO + 'T12:00:00'), [todayISO]);
  const targetDates = useMemo(
    () => [0, 1, 2].map((n) => isoLocal(addDays(today, n))),
    [today]
  );

  const [fetched, setFetched] = useState<FetchState | null>(null);
  const [overrides, setOverrides] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Mejora continua: cerrar el ciclo de planes pasados con ventas cargadas
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

      const [s0, s1, s2, processDays, naveShare, forecast, savedOverrides, accuracy] =
        await Promise.all([
          planningService.suggestions(targetDates[0]),
          planningService.suggestions(targetDates[1]),
          planningService.suggestions(targetDates[2]),
          planningService.processConfig(),
          planningService.locationSplit(),
          weatherService.getForecast(),
          planningService.savedPlans(targetDates),
          planningService.accuracyStats(90),
        ]);

      setFetched({
        suggestionsByDate: {
          [targetDates[0]]: s0,
          [targetDates[1]]: s1,
          [targetDates[2]]: s2,
        },
        processDays,
        naveShare,
        forecast,
        accuracy,
      });
      setOverrides(savedOverrides);
    } catch (e) {
      console.log('[usePipelinePlanning] error:', e);
      setFetched(null);
    } finally {
      setLoading(false);
    }
  }, [targetDates]);

  useEffect(() => {
    load();
  }, [load]);

  const weatherByDate = useMemo(() => {
    const map = new Map<string, WeatherInfo>();
    for (const dateISO of targetDates) {
      const day = fetched?.forecast.find((f) => f.date === dateISO);
      if (day) map.set(dateISO, { day, factor: weatherAdjustmentFactor(day.precipitation, day.tempMax) });
    }
    return map;
  }, [fetched, targetDates]);

  const holidayByDate = useMemo(() => {
    const map = new Map<string, HolidayAdjustment>();
    for (const dateISO of targetDates) map.set(dateISO, holidayAdjustmentFactor(dateISO));
    return map;
  }, [targetDates]);

  const items = useMemo(() => {
    if (!fetched) return [];
    const result: PipelineItem[] = [];
    for (const dateISO of targetDates) {
      const weatherFactor = weatherByDate.get(dateISO)?.factor ?? 1;
      const holidayFactor = holidayByDate.get(dateISO)?.factor ?? 1;
      const sellDateNoon = new Date(dateISO + 'T12:00:00');

      for (const s of fetched.suggestionsByDate[dateISO] ?? []) {
        if (s.family === 'navidad' && !isNavidadSeason(sellDateNoon)) continue;

        const processDays = fetched.processDays.get(s.product_id) ?? DEFAULT_PROCESS_DAYS;
        const assignment = getPhaseAssignments(processDays, today).find(
          (a) => a.sellDate === dateISO
        );
        if (!assignment) continue;

        const suggestedQty = Math.max(0, Math.round(s.suggested_qty * weatherFactor * holidayFactor));
        if (suggestedQty === 0) continue;

        const overrideQty = overrides.get(`${dateISO}_${s.product_id}`) ?? null;
        const effectiveQty = overrideQty ?? suggestedQty;
        const naveShare = fetched.naveShare.get(s.product_id) ?? 0.5;
        const { naveQty, tiendaQty } = splitByLocation(effectiveQty, naveShare);

        result.push({
          productId: s.product_id,
          name: s.name,
          family: s.family,
          processDays,
          phase: assignment.phase,
          sellDate: dateISO,
          daysUntilSale: assignment.daysUntilSale,
          baseQty: s.suggested_qty,
          weatherFactor,
          holidayFactor,
          suggestedQty,
          overrideQty,
          effectiveQty,
          naveQty,
          tiendaQty,
          confidence: s.confidence,
          baseRecent: s.base_recent,
          baseHist: s.base_hist,
          carryover: s.carryover,
          familyAdjusted: false,
        });
      }
    }
    applyFamilySubstitution(result);
    return result;
  }, [fetched, overrides, targetDates, today, weatherByDate, holidayByDate]);

  const pipeline = useMemo(() => {
    const byPhase: Record<Phase, PipelineItem[]> = { horneado: [], fermentacion: [], amasado: [] };
    for (const item of items) byPhase[item.phase].push(item);
    return byPhase;
  }, [items]);

  const summary: PipelineSummary = useMemo(
    () => ({
      totalProducts: new Set(items.map((i) => i.productId)).size,
      totalUnits: items.reduce((s, i) => s + i.effectiveQty, 0),
      unitsByPhase: PHASE_ORDER.reduce(
        (acc, phase) => ({
          ...acc,
          [phase]: pipeline[phase].reduce((s, i) => s + i.effectiveQty, 0),
        }),
        {} as Record<Phase, number>
      ),
      overrideCount: items.filter((i) => i.overrideQty != null).length,
    }),
    [items, pipeline]
  );

  const setOverride = useCallback((sellDate: string, productId: string, qty: number) => {
    setOverrides((prev) => new Map(prev).set(`${sellDate}_${productId}`, qty));
  }, []);

  const clearOverride = useCallback((sellDate: string, productId: string) => {
    setOverrides((prev) => {
      const next = new Map(prev);
      next.delete(`${sellDate}_${productId}`);
      return next;
    });
  }, []);

  const setProcessDays = useCallback(async (productId: string, days: number) => {
    const { error } = await planningService.setProcessDays(productId, days);
    if (!error) {
      setFetched((prev) =>
        prev ? { ...prev, processDays: new Map(prev.processDays).set(productId, days) } : prev
      );
    }
    return { error };
  }, []);

  const saveAll = useCallback(async () => {
    setSaving(true);
    const { error } = await planningService.savePipelinePlan(
      items.map((i) => ({
        plan_date: i.sellDate,
        product_id: i.productId,
        suggested_qty: i.suggestedQty,
        override_qty: i.overrideQty,
        phase: i.phase,
        nave_qty: i.naveQty,
        tienda_qty: i.tiendaQty,
        confidence: i.confidence,
        weather_factor: i.weatherFactor,
        holiday_factor: i.holidayFactor,
      }))
    );
    setSaving(false);
    return { error };
  }, [items]);

  return {
    todayISO,
    targetDates,
    pipeline,
    summary,
    loading,
    saving,
    accuracy: fetched?.accuracy ?? null,
    weatherToday: weatherByDate.get(todayISO) ?? null,
    holidayToday: holidayByDate.get(todayISO) ?? null,
    setOverride,
    clearOverride,
    setProcessDays,
    saveAll,
    refresh: load,
  };
}
