import { compareFamilies } from '@/constants/families';
import { supabase } from '@/lib/supabase';

export interface Product {
  id: string;
  name: string;
  family: string;
  sale_price: number | null;
}

export interface ProductGroup {
  family: string;
  products: Product[];
}

export const productService = {
  // Solo productos de obrador: son los únicos con sobrantes/producción
  async list() {
    return supabase
      .from('products')
      .select('id,name,family,sale_price,display_order')
      .eq('is_active', true)
      .eq('is_obrador', true)
      .order('display_order', { ascending: true, nullsFirst: false })
      .order('name');
  },

  async listGroupedByFamily(): Promise<ProductGroup[]> {
    const { data, error } = await this.list();
    if (error || !data) return [];

    const groups = new Map<string, Product[]>();
    for (const row of data) {
      const product: Product = { ...row, family: row.family ?? 'otros' };
      const family = product.family;
      if (!groups.has(family)) groups.set(family, []);
      groups.get(family)!.push(product);
    }

    const sorted = [...groups.entries()].sort(([a], [b]) => compareFamilies(a, b));

    return sorted.map(([family, products]) => ({ family, products }));
  },

  // Alta manual de un producto puntual desde el cierre del día. Nace como
  // producto de obrador para que entre en sobrantes/producción/plan.
  async createCustom(name: string, family: string) {
    return supabase
      .from('products')
      .insert({
        name: name.trim(),
        family,
        is_active: true,
        is_obrador: true,
        is_custom: true,
        display_order: 99,
      })
      .select('id,name,family,sale_price')
      .single();
  },
};
