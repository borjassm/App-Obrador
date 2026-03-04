import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

export interface DailySummary {
  totalSaved: number;
  totalDiscarded: number;
  wastePercent: number;
  sessionsCount: number;
  productsFilled: number;
}

export interface ProductSummary {
  productId: string;
  productName: string;
  family: string;
  totalSaved: number;
  totalDiscarded: number;
  wastePercent: number;
  daysRecorded: number;
  avgSaved: number;
}

interface UseOperationalDataReturn {
  summary: DailySummary;
  products: ProductSummary[];
  loading: boolean;
  period: string;
  setPeriod: (p: string) => void;
  refresh: () => void;
}

function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayISO(): string {
  return dateOffset(0);
}

const PERIOD_DAYS: Record<string, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

export function useOperationalData(): UseOperationalDataReturn {
  const [period, setPeriod] = useState('7d');
  const [summary, setSummary] = useState<DailySummary>({
    totalSaved: 0,
    totalDiscarded: 0,
    wastePercent: 0,
    sessionsCount: 0,
    productsFilled: 0,
  });
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);

    const days = PERIOD_DAYS[period] ?? 7;
    const startDate = dateOffset(days);
    const endDate = todayISO();

    // Get sessions in period
    const { data: sessions } = await supabase
      .from('daily_sessions')
      .select('id, session_date, status')
      .gte('session_date', startDate)
      .lte('session_date', endDate);

    const sessionIds = (sessions ?? []).map((s) => s.id);

    if (sessionIds.length === 0) {
      setSummary({ totalSaved: 0, totalDiscarded: 0, wastePercent: 0, sessionsCount: 0, productsFilled: 0 });
      setProducts([]);
      setLoading(false);
      return;
    }

    // Get all entries for those sessions
    const { data: entries } = await supabase
      .from('daily_product_entries')
      .select('product_id, saved_qty, discarded_qty, daily_session_id')
      .in('daily_session_id', sessionIds);

    // Get product names
    const { data: productsData } = await supabase
      .from('products')
      .select('id, name, family')
      .eq('is_active', true);

    const productMap = new Map<string, { name: string; family: string }>();
    for (const p of productsData ?? []) {
      productMap.set(p.id, { name: p.name, family: p.family ?? 'otros' });
    }

    // Compute summaries
    let totalSaved = 0;
    let totalDiscarded = 0;

    const byProduct = new Map<string, { saved: number; discarded: number; days: Set<string> }>();

    for (const entry of entries ?? []) {
      const saved = entry.saved_qty ?? 0;
      const discarded = entry.discarded_qty ?? 0;
      totalSaved += saved;
      totalDiscarded += discarded;

      const sessionDate = (sessions ?? []).find((s) => s.id === entry.daily_session_id)?.session_date ?? '';

      if (!byProduct.has(entry.product_id)) {
        byProduct.set(entry.product_id, { saved: 0, discarded: 0, days: new Set() });
      }
      const agg = byProduct.get(entry.product_id)!;
      agg.saved += saved;
      agg.discarded += discarded;
      if (sessionDate) agg.days.add(sessionDate);
    }

    const total = totalSaved + totalDiscarded;

    setSummary({
      totalSaved,
      totalDiscarded,
      wastePercent: total > 0 ? Math.round((totalDiscarded / total) * 100) : 0,
      sessionsCount: sessionIds.length,
      productsFilled: (entries ?? []).length,
    });

    const productSummaries: ProductSummary[] = [];
    for (const [productId, agg] of byProduct) {
      const info = productMap.get(productId);
      const totalProd = agg.saved + agg.discarded;
      productSummaries.push({
        productId,
        productName: info?.name ?? productId,
        family: info?.family ?? 'otros',
        totalSaved: agg.saved,
        totalDiscarded: agg.discarded,
        wastePercent: totalProd > 0 ? Math.round((agg.discarded / totalProd) * 100) : 0,
        daysRecorded: agg.days.size,
        avgSaved: agg.days.size > 0 ? Math.round(agg.saved / agg.days.size) : 0,
      });
    }

    // Sort by waste descending (most waste first = needs attention)
    productSummaries.sort((a, b) => b.wastePercent - a.wastePercent);
    setProducts(productSummaries);
    setLoading(false);
  }, [period]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { summary, products, loading, period, setPeriod, refresh };
}
