import { supabase } from '@/lib/supabase';

export interface Team {
  id: string;
  name: string;
}

export interface TeamItem {
  id: string;
  productId: string | null;
  name: string;
  itemType: 'final' | 'tarea';
  unit: string;
  notes: string | null;
  locationIds: string[];
}

export interface WorkEntry {
  itemId: string;
  locationId: string;
  productionDate: string;
  plannedQty: number | null;
  producedQty: number | null;
  comment: string | null;
}

export interface PlannedRow {
  itemId: string;
  locationId: string;
  productionDate: string;
  plannedQty: number | null;
}

function entryKey(itemId: string, locationId: string, date: string): string {
  return `${itemId}_${locationId}_${date}`;
}

export const teamsService = {
  entryKey,

  async listTeams(): Promise<Team[]> {
    const { data } = await supabase
      .from('production_teams')
      .select('id,name')
      .eq('is_active', true)
      .order('display_order');
    return data ?? [];
  },

  async listItems(teamId: string): Promise<TeamItem[]> {
    const { data } = await supabase
      .from('team_production_items')
      .select('id,product_id,name,item_type,unit,notes,team_item_locations(location_id)')
      .eq('team_id', teamId)
      .eq('is_active', true)
      .order('display_order');
    return (data ?? []).map((row) => ({
      id: row.id,
      productId: row.product_id,
      name: row.name,
      itemType: row.item_type as 'final' | 'tarea',
      unit: row.unit,
      notes: row.notes,
      locationIds: (row.team_item_locations ?? []).map((l) => l.location_id),
    }));
  },

  /** Entradas de trabajo de unos items para varias fechas, indexadas por clave. */
  async entriesFor(
    itemIds: string[],
    locationId: string,
    datesISO: string[]
  ): Promise<Map<string, WorkEntry>> {
    if (itemIds.length === 0) return new Map();
    const { data } = await supabase
      .from('team_production_entries')
      .select('item_id,location_id,production_date,planned_qty,produced_qty,comment')
      .in('item_id', itemIds)
      .eq('location_id', locationId)
      .in('production_date', datesISO);
    const map = new Map<string, WorkEntry>();
    for (const row of data ?? []) {
      map.set(entryKey(row.item_id, row.location_id, row.production_date), {
        itemId: row.item_id,
        locationId: row.location_id,
        productionDate: row.production_date,
        plannedQty: row.planned_qty,
        producedQty: row.produced_qty,
        comment: row.comment,
      });
    }
    return map;
  },

  /** El equipo apunta lo producido (y su comentario). Nunca toca planned_qty:
   *  el upsert solo envía estas columnas y un trigger lo protege además en BD. */
  async upsertProduced(
    itemId: string,
    locationId: string,
    dateISO: string,
    producedQty: number | null,
    comment?: string | null
  ) {
    const payload: {
      item_id: string;
      location_id: string;
      production_date: string;
      produced_qty: number | null;
      comment?: string | null;
    } = {
      item_id: itemId,
      location_id: locationId,
      production_date: dateISO,
      produced_qty: producedQty,
    };
    if (comment !== undefined) payload.comment = comment || null;

    return supabase
      .from('team_production_entries')
      .upsert(payload, { onConflict: 'item_id,location_id,production_date' });
  },

  /** El admin fija el plan (planned_qty) de varias filas de golpe. */
  async setPlanned(rows: PlannedRow[]) {
    if (rows.length === 0) return { error: null };
    const payload = rows.map((r) => ({
      item_id: r.itemId,
      location_id: r.locationId,
      production_date: r.productionDate,
      planned_qty: r.plannedQty,
    }));
    for (let i = 0; i < payload.length; i += 50) {
      const { error } = await supabase
        .from('team_production_entries')
        .upsert(payload.slice(i, i + 50), { onConflict: 'item_id,location_id,production_date' });
      if (error) return { error };
    }
    return { error: null };
  },

  /** Tras guardar un plan, sincroniza production_plans (por producto) para que
   *  la mejora continua (planning_record_accuracy) siga aprendiendo. */
  async syncProductPlans(dateISO: string) {
    const { data } = await supabase
      .from('team_production_entries')
      .select('planned_qty, team_production_items!inner(product_id)')
      .eq('production_date', dateISO)
      .not('planned_qty', 'is', null);

    const byProduct = new Map<string, number>();
    for (const row of data ?? []) {
      const productId = (row.team_production_items as unknown as { product_id: string | null })
        ?.product_id;
      if (!productId) continue;
      byProduct.set(productId, (byProduct.get(productId) ?? 0) + Number(row.planned_qty ?? 0));
    }
    if (byProduct.size === 0) return { error: null };

    const rows = [...byProduct.entries()].map(([productId, qty]) => ({
      plan_date: dateISO,
      product_id: productId,
      suggested_qty: Math.round(qty),
      override_qty: null,
      override_at: null,
    }));
    for (let i = 0; i < rows.length; i += 50) {
      const { error } = await supabase
        .from('production_plans')
        .upsert(rows.slice(i, i + 50), { onConflict: 'plan_date,product_id' });
      if (error) return { error };
    }
    return { error: null };
  },

  /** Suscripción en vivo a la hoja de trabajo de una fecha (Plan ↔ Obrador). */
  subscribeToDate(dateISO: string, onChange: () => void): () => void {
    const channel = supabase
      .channel(`tpe-${dateISO}-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_production_entries',
          filter: `production_date=eq.${dateISO}`,
        },
        onChange
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  },
};
