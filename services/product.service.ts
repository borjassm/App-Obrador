import { compareFamilies, LEFTOVERS_OTHER } from '@/constants/families';
import { supabase } from '@/lib/supabase';

export interface LeftoversSection {
  name: string;
  production_family: string | null;
}

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

  // Secciones activas del registro de sobrantes, en orden
  async listLeftoversSections(): Promise<LeftoversSection[]> {
    const { data, error } = await supabase
      .from('leftovers_sections')
      .select('name,production_family')
      .eq('is_active', true)
      .order('sort_order');
    if (error || !data) return [];
    return data;
  },

  // Registro de sobrantes: secciones de leftovers_sections y, dentro de cada
  // una, el orden de las plantillas Excel del cliente (leftovers_order). Lo
  // que no está en la plantilla va al final de su sección por nombre.
  // show_in_leftovers oculta productos solo aquí (no en producción/plan).
  async listForLeftovers(sections: LeftoversSection[]): Promise<ProductGroup[]> {
    const { data, error } = await supabase
      .from('products')
      .select('id,name,family,sale_price,leftovers_family')
      .eq('is_active', true)
      .eq('is_obrador', true)
      .eq('show_in_leftovers', true)
      .order('leftovers_order', { ascending: true, nullsFirst: false })
      .order('name');
    if (error || !data) return [];

    const groups = new Map<string, Product[]>();
    for (const { leftovers_family, ...row } of data) {
      const section = leftovers_family ?? LEFTOVERS_OTHER;
      if (!groups.has(section)) groups.set(section, []);
      groups.get(section)!.push({ ...row, family: row.family ?? 'otros' });
    }

    const rank = (s: string) => {
      const i = sections.findIndex((sec) => sec.name === s);
      return i === -1 ? sections.length : i;
    };
    return [...groups.entries()]
      .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
      .map(([family, products]) => ({ family, products }));
  },

  // Alta manual de un producto puntual desde el cierre del día, dentro de una
  // sección de sobrantes. Nace como producto de obrador para que entre en
  // sobrantes/producción/plan.
  async createCustom(name: string, section: LeftoversSection) {
    return supabase
      .from('products')
      .insert({
        name: name.trim(),
        family: section.production_family,
        leftovers_family: section.name,
        is_active: true,
        is_obrador: true,
        is_custom: true,
        display_order: 99,
      })
      .select('id,name,family,sale_price')
      .single();
  },
};
