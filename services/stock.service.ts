import { supabase } from '@/lib/supabase';

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface IngredientStock {
  id: string;
  name: string;
  unit: string;
  category: string | null;
  min_stock_level: number | null;
  current_stock: number;
  last_count_date: string | null;
  is_low: boolean;
}

export interface ProductStock {
  id: string;
  name: string;
  family: string | null;
  current_stock: number;
  last_count_date: string | null;
}

export const stockService = {
  // ── Ingredientes (materia prima) ──────────────────────────────────────────
  async listIngredientStock(): Promise<IngredientStock[]> {
    const { data, error } = await supabase
      .from('v_ingredient_stock')
      .select('id,name,unit,category,min_stock_level,current_stock,last_count_date,is_low')
      .order('name');
    if (error || !data) return [];
    return data
      .filter((r): r is typeof r & { id: string; name: string } => !!r.id && !!r.name)
      .map((r) => ({
        id: r.id as string,
        name: r.name as string,
        unit: r.unit ?? 'uds',
        category: r.category,
        min_stock_level: r.min_stock_level,
        current_stock: r.current_stock ?? 0,
        last_count_date: r.last_count_date,
        is_low: r.is_low ?? false,
      }));
  },

  // Registrar recuento de un ingrediente (foto de stock de hoy)
  async recordIngredientCount(ingredientId: string, quantity: number, notes?: string) {
    return supabase
      .from('inventory_entries')
      .upsert(
        { ingredient_id: ingredientId, entry_date: todayISO(), quantity, notes: notes ?? null },
        { onConflict: 'ingredient_id,entry_date' }
      )
      .select('id, ingredient_id, quantity, entry_date')
      .single();
  },

  // ── Producto terminado ────────────────────────────────────────────────────
  async listProductStock(): Promise<ProductStock[]> {
    const { data, error } = await supabase
      .from('v_product_stock')
      .select('id,name,family,current_stock,last_count_date')
      .order('name');
    if (error || !data) return [];
    return data
      .filter((r): r is typeof r & { id: string; name: string } => !!r.id && !!r.name)
      .map((r) => ({
        id: r.id as string,
        name: r.name as string,
        family: r.family,
        current_stock: r.current_stock ?? 0,
        last_count_date: r.last_count_date,
      }));
  },

  // Registrar recuento manual de producto terminado (foto de stock de hoy)
  async recordProductCount(productId: string, quantity: number, notes?: string) {
    return supabase
      .from('product_stock_counts')
      .upsert(
        { product_id: productId, count_date: todayISO(), quantity, notes: notes ?? null },
        { onConflict: 'product_id,count_date' }
      )
      .select('id, product_id, quantity, count_date')
      .single();
  },
};
