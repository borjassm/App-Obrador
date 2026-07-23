import { supabase } from '@/lib/supabase';

export interface Overview {
  total_revenue: number;
  total_units: number;
  active_products: number;
  days_with_sales: number;
  avg_daily_revenue: number;
}

export interface DailyPoint {
  sale_date: string;
  revenue: number;
  units: number;
}

export interface TopProduct {
  product_id: string;
  name: string;
  family: string;
  units: number;
  revenue: number;
  revenue_share: number;
}

export interface FamilyRow {
  family: string;
  units: number;
  revenue: number;
  revenue_share: number;
}

export interface WeekdayRow {
  weekday: number;
  avg_revenue: number;
  avg_units: number;
}

export interface WasteRow {
  product_id: string;
  name: string;
  family: string;
  discarded: number;
  saved: number;
  waste_cost: number;
  lost_revenue: number;
}

export interface WastePoint {
  session_date: string;
  waste_qty: number;
  waste_cost: number;
}

export interface ProfitRow {
  product_id: string;
  name: string;
  family: string;
  units: number;
  revenue: number;
  unit_cost: number;
  est_margin: number;
  margin_pct: number;
}

export interface LatestDates {
  latest_sale: string | null;
  latest_session: string | null;
  latest_production: string | null;
}

// Todas las funciones aceptan un locationId opcional (null = todas las
// ubicaciones), añadido en la migración 0010
export const analyticsService = {
  async latestDates(): Promise<LatestDates | null> {
    const { data } = await supabase.rpc('analytics_latest_dates');
    return data?.[0] ?? null;
  },

  async overview(start: string, end: string, locationId: string | null = null): Promise<Overview | null> {
    const { data } = await supabase.rpc('analytics_overview', {
      p_start: start, p_end: end, p_location: locationId,
    });
    return data?.[0] ?? null;
  },

  async dailySeries(start: string, end: string, locationId: string | null = null): Promise<DailyPoint[]> {
    const { data } = await supabase.rpc('analytics_daily_series', {
      p_start: start, p_end: end, p_location: locationId,
    });
    return data ?? [];
  },

  async topProducts(start: string, end: string, limit = 10, locationId: string | null = null): Promise<TopProduct[]> {
    const { data } = await supabase.rpc('analytics_top_products', {
      p_start: start, p_end: end, p_limit: limit, p_location: locationId,
    });
    return data ?? [];
  },

  async familyBreakdown(start: string, end: string, locationId: string | null = null): Promise<FamilyRow[]> {
    const { data } = await supabase.rpc('analytics_family_breakdown', {
      p_start: start, p_end: end, p_location: locationId,
    });
    return data ?? [];
  },

  async weekdayPattern(start: string, end: string, locationId: string | null = null): Promise<WeekdayRow[]> {
    const { data } = await supabase.rpc('analytics_weekday_pattern', {
      p_start: start, p_end: end, p_location: locationId,
    });
    return data ?? [];
  },

  async waste(start: string, end: string, limit = 15, locationId: string | null = null): Promise<WasteRow[]> {
    const { data } = await supabase.rpc('analytics_waste', {
      p_start: start, p_end: end, p_limit: limit, p_location: locationId,
    });
    return data ?? [];
  },

  async wasteSeries(start: string, end: string, locationId: string | null = null): Promise<WastePoint[]> {
    const { data } = await supabase.rpc('analytics_waste_series', {
      p_start: start, p_end: end, p_location: locationId,
    });
    return data ?? [];
  },

  async productSeries(start: string, end: string, productId: string, locationId: string | null = null): Promise<DailyPoint[]> {
    const { data } = await supabase.rpc('analytics_product_series', {
      p_start: start, p_end: end, p_product: productId, p_location: locationId,
    });
    return data ?? [];
  },

  async profitability(start: string, end: string, limit = 15, locationId: string | null = null): Promise<ProfitRow[]> {
    const { data } = await supabase.rpc('analytics_profitability', {
      p_start: start, p_end: end, p_limit: limit, p_location: locationId,
    });
    return data ?? [];
  },
};
