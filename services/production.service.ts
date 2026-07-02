import { supabase } from '@/lib/supabase';

export interface ProductionStatus {
  product_id: string;
  name: string;
  family: string;
  planned: number | null;   // del plan (override si existe, si no sugerido)
  produced: number | null;  // registrado en production_entries
}

export const productionService = {
  /** Estado de producción de una fecha: todos los productos activos + plan + producido. */
  async statusFor(dateISO: string): Promise<ProductionStatus[]> {
    const [{ data: products }, { data: plans }, { data: entries }] = await Promise.all([
      supabase
        .from('products')
        .select('id,name,family,display_order')
        .eq('is_active', true)
        .order('display_order', { ascending: true, nullsFirst: false })
        .order('name'),
      supabase
        .from('production_plans')
        .select('product_id, suggested_qty, override_qty')
        .eq('plan_date', dateISO),
      supabase
        .from('production_entries')
        .select('product_id, quantity')
        .eq('production_date', dateISO),
    ]);

    const planMap = new Map<string, number>();
    for (const p of plans ?? []) planMap.set(p.product_id, p.override_qty ?? p.suggested_qty);

    const prodMap = new Map<string, number>();
    for (const e of entries ?? []) prodMap.set(e.product_id, e.quantity);

    return (products ?? []).map((p) => ({
      product_id: p.id,
      name: p.name,
      family: p.family ?? 'otros',
      planned: planMap.get(p.id) ?? null,
      produced: prodMap.get(p.id) ?? null,
    }));
  },

  /** Registra (o corrige) lo producido de un producto en una fecha. */
  async recordProduction(productId: string, dateISO: string, quantity: number, notes?: string) {
    return supabase
      .from('production_entries')
      .upsert(
        { product_id: productId, production_date: dateISO, quantity, notes: notes ?? null },
        { onConflict: 'product_id,production_date' }
      )
      .select('id')
      .single();
  },
};
