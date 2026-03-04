import { supabase } from '@/lib/supabase';

export interface Product {
  id: string;
  name: string;
  family: string;
  is_weekend_special: boolean;
  is_christmas_special: boolean;
}

export interface ProductGroup {
  family: string;
  products: Product[];
}

export const productService = {
  async list() {
    return supabase
      .from('products')
      .select('id,name,family,is_weekend_special,is_christmas_special')
      .eq('is_active', true)
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

    // Sort families: panaderia first, then laminado, then navidad, then rest
    const familyOrder = ['panaderia', 'laminado', 'navidad'];
    const sorted = [...groups.entries()].sort(([a], [b]) => {
      const ia = familyOrder.indexOf(a);
      const ib = familyOrder.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });

    return sorted.map(([family, products]) => ({ family, products }));
  },
};
