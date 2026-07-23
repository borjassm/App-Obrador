import { supabase } from '@/lib/supabase';

export interface Suggestion {
  product_id: string;
  name: string;
  family: string;
  suggested_qty: number;
  base_recent: number;
  base_hist: number;
  carryover: number;
  trend_weight: number;
  confidence: string;
  samples: number;
}

export interface PlanRow {
  product_id: string;
  suggested_qty: number;
  override_qty: number | null;
  phase: string;
}

export interface AccuracyStats {
  n: number;
  mape: number;
  hit_rate: number;
}

export interface PipelinePlanRow {
  plan_date: string;
  product_id: string;
  suggested_qty: number;
  override_qty: number | null;
  phase: string;
  nave_qty: number;
  tienda_qty: number;
  confidence: string;
  weather_factor: number;
  holiday_factor: number;
}

export const planningService = {
  /** Sugerencias calculadas por el motor (día de la semana + pesos por producto). */
  async suggestions(dateISO: string): Promise<Suggestion[]> {
    const { data, error } = await supabase.rpc('planning_suggestions', { p_date: dateISO });
    if (error) console.log('[planning] suggestions error:', error);
    return data ?? [];
  },

  /** Plan ya guardado para una fecha (con overrides del usuario). */
  async savedPlan(dateISO: string): Promise<Map<string, PlanRow>> {
    const { data } = await supabase
      .from('production_plans')
      .select('product_id, suggested_qty, override_qty, phase')
      .eq('plan_date', dateISO);
    const map = new Map<string, PlanRow>();
    for (const row of data ?? []) map.set(row.product_id, row);
    return map;
  },

  /** Guarda (o actualiza) el plan de una fecha. */
  async savePlan(
    dateISO: string,
    rows: { product_id: string; suggested_qty: number; override_qty: number | null; confidence: string }[]
  ) {
    return supabase.from('production_plans').upsert(
      rows.map((r) => ({
        plan_date: dateISO,
        product_id: r.product_id,
        suggested_qty: r.suggested_qty,
        override_qty: r.override_qty,
        override_at: r.override_qty != null ? new Date().toISOString() : null,
        confidence: r.confidence,
      })),
      { onConflict: 'plan_date,product_id' }
    );
  },

  /** Overrides guardados de varias fechas, con clave `${plan_date}_${product_id}`. */
  async savedPlans(datesISO: string[]): Promise<Map<string, number>> {
    const { data } = await supabase
      .from('production_plans')
      .select('plan_date, product_id, override_qty')
      .in('plan_date', datesISO);
    const map = new Map<string, number>();
    for (const row of data ?? []) {
      if (row.override_qty != null) map.set(`${row.plan_date}_${row.product_id}`, row.override_qty);
    }
    return map;
  },

  /** Guarda el plan del pipeline (varias fechas de venta, con fase y factores). */
  async savePipelinePlan(rows: PipelinePlanRow[]) {
    const now = new Date().toISOString();
    const payload = rows.map((r) => ({
      ...r,
      override_at: r.override_qty != null ? now : null,
    }));
    for (let i = 0; i < payload.length; i += 50) {
      const { error } = await supabase
        .from('production_plans')
        .upsert(payload.slice(i, i + 50), { onConflict: 'plan_date,product_id' });
      if (error) return { error };
    }
    return { error: null };
  },

  /** Días de proceso por producto (product_process_config). */
  async processConfig(): Promise<Map<string, number>> {
    const { data } = await supabase
      .from('product_process_config')
      .select('product_id, process_days');
    return new Map((data ?? []).map((r) => [r.product_id, r.process_days]));
  },

  async setProcessDays(productId: string, processDays: number) {
    return supabase
      .from('product_process_config')
      .upsert(
        { product_id: productId, process_days: processDays, updated_at: new Date().toISOString() },
        { onConflict: 'product_id' }
      );
  },

  /** Cuota histórica de la Nave por producto (para repartir Nave/Tienda). */
  async locationSplit(): Promise<Map<string, number>> {
    const { data } = await supabase.rpc('planning_location_split');
    return new Map((data ?? []).map((r) => [r.product_id, Number(r.nave_share)]));
  },

  /** Cierra el ciclo de mejora continua: registra aciertos y ajusta pesos. */
  async recordAccuracy(dateISO: string): Promise<number> {
    const { data, error } = await supabase.rpc('planning_record_accuracy', { p_date: dateISO });
    if (error) console.log('[planning] recordAccuracy error:', error);
    return data ?? 0;
  },

  async accuracyStats(days = 60): Promise<AccuracyStats | null> {
    const { data } = await supabase.rpc('planning_accuracy_stats', { p_days: days });
    const row = data?.[0];
    return row && row.n > 0 ? row : null;
  },
};
