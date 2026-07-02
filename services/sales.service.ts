import { supabase } from '@/lib/supabase';

export const salesService = {
  async dailySales(locationId: string, startDate: string, endDate: string) {
    return supabase
      .from('sales_daily')
      .select('sale_date,product_id,sold_qty,revenue,products(name)')
      .eq('location_id', locationId)
      .gte('sale_date', startDate)
      .lte('sale_date', endDate)
      .order('sale_date', { ascending: false });
  }
};
