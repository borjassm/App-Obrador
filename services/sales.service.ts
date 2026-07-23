import { supabase } from '@/lib/supabase';

export interface SalesSummary {
  total_revenue: number;
  total_units: number;
  active_products: number;
  days_with_sales: number;
  avg_daily_revenue: number;
}

export interface SalesDailyPoint {
  sale_date: string;
  revenue: number;
  units: number;
}

export interface SalesProductRow {
  product_id: string;
  name: string;
  family: string;
  units: number;
  revenue: number;
  avg_units_per_day: number;
  revenue_share: number;
}

// Pestaña Ventas: RPC sales_period_* (migración 0008), con filtro opcional
// de ubicación (null = todas)
export const salesService = {
  async periodSummary(
    start: string,
    end: string,
    locationId: string | null = null
  ): Promise<SalesSummary | null> {
    const { data } = await supabase.rpc('sales_period_summary', {
      p_start: start,
      p_end: end,
      p_location: locationId,
    });
    return data?.[0] ?? null;
  },

  async periodSeries(
    start: string,
    end: string,
    locationId: string | null = null
  ): Promise<SalesDailyPoint[]> {
    const { data } = await supabase.rpc('sales_period_series', {
      p_start: start,
      p_end: end,
      p_location: locationId,
    });
    return data ?? [];
  },

  async periodProducts(
    start: string,
    end: string,
    locationId: string | null = null,
    limit = 200
  ): Promise<SalesProductRow[]> {
    const { data } = await supabase.rpc('sales_period_products', {
      p_start: start,
      p_end: end,
      p_location: locationId,
      p_limit: limit,
    });
    return data ?? [];
  },

  async firstSaleDate(): Promise<string | null> {
    const { data } = await supabase.rpc('sales_first_date');
    return data ?? null;
  },
};
