import * as XLSX from 'xlsx';

import { compareFamilies } from '@/constants/families';
import { supabase } from '@/lib/supabase';

export interface ProductWithCost {
  id: string;
  name: string;
  family: string;
  salePrice: number | null;
  unitCost: number | null;
  margin: number | null; // € por unidad (PVP - coste)
  marginPct: number | null; // % sobre el precio de venta
}

export interface CostRow {
  productName: string;
  unitCost: number;
}

export interface BulkImportResult {
  matched: number;
  unmatched: string[];
}

// Parsea un CSV "producto;coste" (o "producto,coste"). Las filas cuya segunda
// columna no sea numérica (p. ej. la cabecera) se ignoran. Decimal europeo.
export function parseCostCsv(text: string): CostRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const sep = text.includes(';') ? ';' : ',';
  const rows: CostRow[] = [];
  for (const line of lines) {
    const cols = line.split(sep);
    if (cols.length < 2) continue;
    const productName = cols[0].replace(/^["']+|["']+$/g, '').trim();
    const unitCost = parseFloat(cols[1].replace(/["']/g, '').trim().replace(',', '.'));
    if (!productName || Number.isNaN(unitCost)) continue;
    rows.push({ productName, unitCost });
  }
  return rows;
}

// Parsea un Excel (primera hoja): columna A = producto, columna B = coste
export function parseCostExcel(data: string | ArrayBuffer): CostRow[] {
  const wb =
    typeof data === 'string'
      ? XLSX.read(data, { type: 'base64' })
      : XLSX.read(data, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
  const rows: CostRow[] = [];
  for (const cells of raw) {
    if (!cells || cells.length < 2) continue;
    const productName = String(cells[0] ?? '').trim();
    const unitCost =
      typeof cells[1] === 'number'
        ? cells[1]
        : parseFloat(String(cells[1] ?? '').trim().replace(',', '.'));
    if (!productName || Number.isNaN(unitCost)) continue;
    rows.push({ productName, unitCost });
  }
  return rows;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export const costService = {
  // Productos de obrador con su coste vigente (product_costs más reciente por
  // valid_from) y el margen calculado contra sale_price
  async getProductsWithCosts(): Promise<ProductWithCost[]> {
    const [productsRes, costsRes] = await Promise.all([
      supabase
        .from('products')
        .select('id,name,family,sale_price')
        .eq('is_active', true)
        .eq('is_obrador', true)
        .order('display_order', { ascending: true, nullsFirst: false })
        .order('name'),
      supabase
        .from('product_costs')
        .select('product_id,unit_cost,valid_from')
        .order('valid_from', { ascending: false }),
    ]);
    if (productsRes.error) throw productsRes.error;
    if (costsRes.error) throw costsRes.error;

    // Orden valid_from desc → el primer registro visto por producto es el vigente
    const costMap = new Map<string, number>();
    for (const c of costsRes.data ?? []) {
      if (!costMap.has(c.product_id)) costMap.set(c.product_id, Number(c.unit_cost));
    }

    const rows = (productsRes.data ?? []).map((p): ProductWithCost => {
      const salePrice = p.sale_price != null ? Number(p.sale_price) : null;
      const unitCost = costMap.get(p.id) ?? null;
      const margin =
        salePrice != null && unitCost != null ? +(salePrice - unitCost).toFixed(2) : null;
      const marginPct =
        margin != null && salePrice != null && salePrice > 0
          ? +((margin / salePrice) * 100).toFixed(1)
          : null;
      return { id: p.id, name: p.name, family: p.family ?? 'otros', salePrice, unitCost, margin, marginPct };
    });

    // Orden estable: familias canónicas; dentro se conserva display_order/name
    rows.sort((a, b) => compareFamilies(a.family, b.family));
    return rows;
  },

  // Nuevo coste con vigencia desde hoy (histórico en product_costs)
  async upsertCost(productId: string, unitCost: number) {
    return supabase
      .from('product_costs')
      .upsert(
        { product_id: productId, unit_cost: unitCost, valid_from: todayISO() },
        { onConflict: 'product_id,valid_from' }
      );
  },

  // Importación masiva: match por nombre (case-insensitive, trim) contra todos
  // los productos activos; upsert por lotes con valid_from = hoy
  async bulkUpsertCosts(rows: CostRow[]): Promise<BulkImportResult> {
    const { data: products, error } = await supabase
      .from('products')
      .select('id,name')
      .eq('is_active', true);
    if (error) throw error;

    const nameMap = new Map((products ?? []).map((p) => [p.name.toLowerCase().trim(), p.id]));
    const unmatched: string[] = [];
    // Si el archivo repite un producto, gana la última fila (evita conflicto de
    // upsert doble sobre la misma clave en un mismo lote)
    const byProduct = new Map<string, { product_id: string; unit_cost: number; valid_from: string }>();
    const validFrom = todayISO();
    for (const row of rows) {
      const productId = nameMap.get(row.productName.toLowerCase().trim());
      if (productId && row.unitCost > 0) {
        byProduct.set(productId, { product_id: productId, unit_cost: row.unitCost, valid_from: validFrom });
      } else {
        unmatched.push(row.productName);
      }
    }

    const toUpsert = [...byProduct.values()];
    for (let i = 0; i < toUpsert.length; i += 50) {
      const { error: upsertError } = await supabase
        .from('product_costs')
        .upsert(toUpsert.slice(i, i + 50), { onConflict: 'product_id,valid_from' });
      if (upsertError) throw upsertError;
    }
    return { matched: toUpsert.length, unmatched };
  },
};
