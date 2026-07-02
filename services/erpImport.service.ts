import { supabase } from '@/lib/supabase';

/**
 * Importador de ventas del ERP (formato "block72": CSV separado por ';').
 * Columnas: [1]=Fecha dd/mm/yyyy · [4]=Establecimiento · [9]=Uds.V · [10]=Artículo · [15]=Neto
 *
 * - Excluye establecimientos "SIN USO…" y filas sin artículo.
 * - Agrega a totales por (día, tienda, producto).
 * - Crea tiendas/productos que no existan (productos nuevos marcados is_custom).
 * - Upsert idempotente a sales_daily (re-importar el mismo archivo no duplica).
 */

export interface ImportResult {
  rowsRead: number;
  rowsExcluded: number;
  aggregated: number;
  productsCreated: number;
  locationsCreated: number;
  upserted: number;
  dateRange: { from: string; to: string } | null;
  errors: string[];
}

export type ProgressFn = (pct: number, message: string) => void;

function parseSpanishNumber(s: string): number {
  const clean = (s ?? '').trim().replace(/\./g, '').replace(',', '.');
  const n = parseFloat(clean);
  return Number.isFinite(n) ? n : 0;
}

function parseDateDDMMYYYY(s: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((s ?? '').trim());
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export async function importErpCsv(csvText: string, onProgress: ProgressFn): Promise<ImportResult> {
  const result: ImportResult = {
    rowsRead: 0,
    rowsExcluded: 0,
    aggregated: 0,
    productsCreated: 0,
    locationsCreated: 0,
    upserted: 0,
    dateRange: null,
    errors: [],
  };

  onProgress(5, 'Leyendo archivo…');
  const lines = csvText.split(/\r?\n/);

  // Agregación en memoria: clave = fecha|tienda|producto
  const agg = new Map<string, { date: string; location: string; product: string; qty: number; revenue: number }>();
  let minDate = '9999-12-31';
  let maxDate = '0000-01-01';

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const cols = line.split(';');
    if (cols.length < 16) continue;
    result.rowsRead++;

    const date = parseDateDDMMYYYY(cols[1]);
    const location = (cols[4] ?? '').trim();
    const product = (cols[10] ?? '').trim();

    if (!date || !product || !location || location.toUpperCase().startsWith('SIN USO')) {
      result.rowsExcluded++;
      continue;
    }

    const qty = parseSpanishNumber(cols[9]);
    const revenue = parseSpanishNumber(cols[15]);

    const key = `${date}|${location}|${product}`;
    const existing = agg.get(key);
    if (existing) {
      existing.qty += qty;
      existing.revenue += revenue;
    } else {
      agg.set(key, { date, location, product, qty, revenue });
    }
    if (date < minDate) minDate = date;
    if (date > maxDate) maxDate = date;
  }

  result.aggregated = agg.size;
  if (agg.size === 0) {
    result.errors.push('No se encontraron filas válidas. ¿Es un CSV del ERP separado por ";"?');
    return result;
  }
  result.dateRange = { from: minDate, to: maxDate };

  onProgress(30, `${result.rowsRead.toLocaleString('es-ES')} líneas leídas · ${agg.size.toLocaleString('es-ES')} totales diarios`);

  // ── Resolver tiendas ─────────────────────────────────────────────────────
  const { data: existingLocs, error: locErr } = await supabase.from('locations').select('id,name');
  if (locErr) {
    result.errors.push('No se pudieron leer las ubicaciones: ' + locErr.message);
    return result;
  }
  const locMap = new Map<string, string>();
  for (const l of existingLocs ?? []) locMap.set(l.name.trim().toUpperCase(), l.id);

  const newLocNames = [...new Set([...agg.values()].map((a) => a.location))].filter(
    (name) => !locMap.has(name.toUpperCase())
  );
  if (newLocNames.length > 0) {
    const { data: created, error } = await supabase
      .from('locations')
      .insert(newLocNames.map((name) => ({ name })))
      .select('id,name');
    if (error) {
      result.errors.push('Error creando ubicaciones: ' + error.message);
      return result;
    }
    for (const l of created ?? []) locMap.set(l.name.trim().toUpperCase(), l.id);
    result.locationsCreated = newLocNames.length;
  }

  // ── Resolver productos ───────────────────────────────────────────────────
  onProgress(40, 'Emparejando productos…');
  const { data: existingProds, error: prodErr } = await supabase.from('products').select('id,name');
  if (prodErr) {
    result.errors.push('No se pudieron leer los productos: ' + prodErr.message);
    return result;
  }
  const prodMap = new Map<string, string>();
  for (const p of existingProds ?? []) prodMap.set(p.name.trim().toUpperCase(), p.id);

  const newProdNames = [...new Set([...agg.values()].map((a) => a.product))].filter(
    (name) => !prodMap.has(name.toUpperCase())
  );
  // Insertar productos nuevos en lotes (marcados is_custom para revisarlos luego)
  for (let i = 0; i < newProdNames.length; i += 200) {
    const batch = newProdNames.slice(i, i + 200);
    const { data: created, error } = await supabase
      .from('products')
      .insert(batch.map((name) => ({ name, is_custom: true })))
      .select('id,name');
    if (error) {
      result.errors.push('Error creando productos: ' + error.message);
      return result;
    }
    for (const p of created ?? []) prodMap.set(p.name.trim().toUpperCase(), p.id);
  }
  result.productsCreated = newProdNames.length;

  // ── Upsert a sales_daily en lotes ────────────────────────────────────────
  const rows = [...agg.values()].map((a) => ({
    sale_date: a.date,
    location_id: locMap.get(a.location.toUpperCase())!,
    product_id: prodMap.get(a.product.toUpperCase())!,
    sold_qty: Math.round(a.qty * 100) / 100,
    revenue: Math.round(a.revenue * 100) / 100,
    source: 'erp_import',
  }));

  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase
      .from('sales_daily')
      .upsert(chunk, { onConflict: 'location_id,sale_date,product_id,source' });
    if (error) {
      result.errors.push(`Error guardando el lote ${i / CHUNK + 1}: ` + error.message);
      return result;
    }
    result.upserted += chunk.length;
    onProgress(
      40 + Math.round((result.upserted / rows.length) * 55),
      `Guardando ventas… ${result.upserted.toLocaleString('es-ES')}/${rows.length.toLocaleString('es-ES')}`
    );
  }

  onProgress(100, 'Importación completada');
  return result;
}
