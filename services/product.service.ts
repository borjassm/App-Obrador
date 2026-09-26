import {
  compareFamilies,
  compareLeftoversSections,
  LEFTOVERS_OTHER,
  LEFTOVERS_SECTION_FAMILY,
} from '@/constants/families';
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

  // Registro de sobrantes: secciones y orden de las plantillas Excel del
  // cliente (leftovers_family / leftovers_order). Lo que no está en la
  // plantilla va al final de su sección por nombre, o a 'Otros'.
  async listForLeftovers(): Promise<ProductGroup[]> {
    const { data, error } = await supabase
      .from('products')
      .select('id,name,family,sale_price,leftovers_family')
      .eq('is_active', true)
      .eq('is_obrador', true)
      .order('leftovers_order', { ascending: true, nullsFirst: false })
      .order('name');
    if (error || !data) return [];

    const groups = new Map<string, Product[]>();
    for (const { leftovers_family, ...row } of data) {
      const section = leftovers_family ?? LEFTOVERS_OTHER;
      if (!groups.has(section)) groups.set(section, []);
      groups.get(section)!.push({ ...row, family: row.family ?? 'otros' });
    }

    return [...groups.entries()]
      .sort(([a], [b]) => compareLeftoversSections(a, b))
      .map(([family, products]) => ({ family, products }));
  },

  // Alta manual de un producto puntual desde el cierre del día, dentro de una
  // sección de sobrantes. Nace como producto de obrador para que entre en
  // sobrantes/producción/plan.
  async createCustom(name: string, section: string) {
    return supabase
      .from('products')
      .insert({
        name: name.trim(),
        family: LEFTOVERS_SECTION_FAMILY[section] ?? null,
        leftovers_family: section,
        is_active: true,
        is_obrador: true,
        is_custom: true,
        display_order: 99,
      })
      .select('id,name,family,sale_price')
      .single();
  },
};
