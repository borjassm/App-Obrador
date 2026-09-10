import { supabase } from '@/lib/supabase';

export interface ShipmentSummary {
  id: string;
  shipmentDate: string;
  originName: string;
  destName: string;
  trip: number;
  status: 'enviado' | 'recibido';
  itemCount: number;
  totalSent: number;
}

export interface ShipmentLine {
  id: string;
  productId: string;
  productName: string;
  family: string;
  qtySent: number;
  qtyReceived: number | null;
  comment: string | null;
}

export interface ShipmentDetail {
  id: string;
  shipmentDate: string;
  originName: string;
  destName: string;
  trip: number;
  status: 'enviado' | 'recibido';
  notes: string | null;
  lines: ShipmentLine[];
}

export const shipmentsService = {
  /** Envíos recientes (últimos días), más nuevos primero. */
  async listRecent(sinceISO: string): Promise<ShipmentSummary[]> {
    const { data } = await supabase
      .from('shipments')
      .select(
        'id,shipment_date,trip,status,origin:locations!shipments_origin_location_id_fkey(name),dest:locations!shipments_dest_location_id_fkey(name),shipment_items(qty_sent)'
      )
      .gte('shipment_date', sinceISO)
      .order('shipment_date', { ascending: false })
      .order('created_at', { ascending: false });

    return (data ?? []).map((row) => ({
      id: row.id,
      shipmentDate: row.shipment_date,
      originName: (row.origin as unknown as { name: string })?.name ?? '',
      destName: (row.dest as unknown as { name: string })?.name ?? '',
      trip: row.trip,
      status: row.status as 'enviado' | 'recibido',
      itemCount: (row.shipment_items ?? []).length,
      totalSent: (row.shipment_items ?? []).reduce((s, i) => s + Number(i.qty_sent), 0),
    }));
  },

  async getDetail(shipmentId: string): Promise<ShipmentDetail | null> {
    const { data } = await supabase
      .from('shipments')
      .select(
        'id,shipment_date,trip,status,notes,origin:locations!shipments_origin_location_id_fkey(name),dest:locations!shipments_dest_location_id_fkey(name),shipment_items(id,product_id,qty_sent,qty_received,comment,products(name,family))'
      )
      .eq('id', shipmentId)
      .single();
    if (!data) return null;

    return {
      id: data.id,
      shipmentDate: data.shipment_date,
      originName: (data.origin as unknown as { name: string })?.name ?? '',
      destName: (data.dest as unknown as { name: string })?.name ?? '',
      trip: data.trip,
      status: data.status as 'enviado' | 'recibido',
      notes: data.notes,
      lines: (data.shipment_items ?? [])
        .map((item) => ({
          id: item.id,
          productId: item.product_id,
          productName:
            (item.products as unknown as { name: string; family: string | null })?.name ?? '',
          family:
            (item.products as unknown as { name: string; family: string | null })?.family ??
            'otros',
          qtySent: Number(item.qty_sent),
          qtyReceived: item.qty_received != null ? Number(item.qty_received) : null,
          comment: item.comment,
        }))
        .sort((a, b) => a.productName.localeCompare(b.productName)),
    };
  },

  /** El repartidor crea un envío con sus líneas. */
  async create(
    originLocationId: string,
    destLocationId: string,
    trip: number,
    dateISO: string,
    lines: { productId: string; qtySent: number }[],
    notes?: string
  ): Promise<{ id: string | null; error: string | null }> {
    const { data: shipment, error } = await supabase
      .from('shipments')
      .insert({
        shipment_date: dateISO,
        origin_location_id: originLocationId,
        dest_location_id: destLocationId,
        trip,
        notes: notes || null,
      })
      .select('id')
      .single();
    if (error || !shipment) return { id: null, error: 'No se pudo crear el envío.' };

    const { error: itemsError } = await supabase.from('shipment_items').insert(
      lines.map((l) => ({
        shipment_id: shipment.id,
        product_id: l.productId,
        qty_sent: l.qtySent,
      }))
    );
    if (itemsError) return { id: shipment.id, error: 'Envío creado pero fallaron las líneas.' };
    return { id: shipment.id, error: null };
  },

  /** La tienda confirma la recepción (cantidades reales + comentarios). */
  async confirmReception(
    shipmentId: string,
    lines: { id: string; qtyReceived: number; comment?: string | null }[]
  ): Promise<{ error: string | null }> {
    for (const line of lines) {
      const { error } = await supabase
        .from('shipment_items')
        .update({ qty_received: line.qtyReceived, comment: line.comment ?? null })
        .eq('id', line.id);
      if (error) return { error: 'No se pudo guardar una de las líneas.' };
    }
    const { error } = await supabase
      .from('shipments')
      .update({ status: 'recibido' as const, received_at: new Date().toISOString() })
      .eq('id', shipmentId);
    return { error: error ? 'No se pudo cerrar la recepción.' : null };
  },
};
