import { useCallback, useEffect, useState } from 'react';

import { compareFamilies } from '@/constants/families';
import { supabase } from '@/lib/supabase';

export interface ProductPlan {
  productId: string;
  productName: string;
  family: string;
  avgSaved7: number;
  avgDiscarded7: number;
  avgSaved30: number;
  suggested: number;
  confidence: 'low' | 'medium' | 'high';
}

function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function usePlanningData() {
  const [plans, setPlans] = useState<ProductPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);

    // Get sessions from last 30 days
    const start30 = dateOffset(30);
    const start7 = dateOffset(7);
    const today = dateOffset(0);

    const { data: sessions } = await supabase
      .from('daily_sessions')
      .select('id, session_date')
      .gte('session_date', start30)
      .lte('session_date', today);

    if (!sessions || sessions.length === 0) {
      setPlans([]);
      setLoading(false);
      return;
    }

    const sessionIds = sessions.map((s) => s.id);
    const sessionDateMap = new Map(sessions.map((s) => [s.id, s.session_date]));

    // Get all entries
    const { data: entries } = await supabase
      .from('daily_product_entries')
      .select('product_id, saved_qty, discarded_qty, daily_session_id')
      .in('daily_session_id', sessionIds);

    // Get products
    const { data: products } = await supabase
      .from('products')
      .select('id, name, family')
      .eq('is_active', true)
      .order('name');

    const productMap = new Map<string, { name: string; family: string }>();
    for (const p of products ?? []) {
      productMap.set(p.id, { name: p.name, family: p.family ?? 'otros' });
    }

    // Aggregate per product, split by 7d and 30d
    const byProduct = new Map<string, {
      saved7: number[]; discarded7: number[];
      saved30: number[]; discarded30: number[];
    }>();

    for (const entry of entries ?? []) {
      const date = sessionDateMap.get(entry.daily_session_id) ?? '';
      if (!byProduct.has(entry.product_id)) {
        byProduct.set(entry.product_id, { saved7: [], discarded7: [], saved30: [], discarded30: [] });
      }
      const agg = byProduct.get(entry.product_id)!;
      agg.saved30.push(entry.saved_qty ?? 0);
      agg.discarded30.push(entry.discarded_qty ?? 0);
      if (date >= start7) {
        agg.saved7.push(entry.saved_qty ?? 0);
        agg.discarded7.push(entry.discarded_qty ?? 0);
      }
    }

    const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

    const result: ProductPlan[] = [];
    for (const [productId, agg] of byProduct) {
      const info = productMap.get(productId);
      const avgSaved7 = avg(agg.saved7);
      const avgDiscarded7 = avg(agg.discarded7);
      const avgSaved30 = avg(agg.saved30);

      // Suggestion: weighted avg of 7d and 30d, add buffer
      const weighted = Math.round(avgSaved7 * 0.7 + avgSaved30 * 0.3);
      const buffer = Math.max(1, Math.round(weighted * 0.1)); // 10% buffer
      const suggested = weighted + buffer;

      const totalDays = agg.saved30.length;
      const confidence: 'low' | 'medium' | 'high' =
        totalDays >= 20 ? 'high' :
        totalDays >= 7 ? 'medium' :
        'low';

      result.push({
        productId,
        productName: info?.name ?? productId,
        family: info?.family ?? 'otros',
        avgSaved7,
        avgDiscarded7,
        avgSaved30,
        suggested,
        confidence,
      });
    }

    // Sort by family, then name
    result.sort(
      (a, b) => compareFamilies(a.family, b.family) || a.productName.localeCompare(b.productName)
    );

    setPlans(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { plans, loading, refresh };
}
