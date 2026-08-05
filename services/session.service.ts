import { supabase } from '@/lib/supabase';

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const SESSION_COLS = 'id, location_id, session_date, status, created_at' as const;

export const sessionService = {
  async openSession(locationId: string, date: string, _userId: string): Promise<{ data: { id: string; status: string } | null; error: unknown }> {
    const existing = await supabase
      .from('daily_sessions')
      .select(SESSION_COLS)
      .eq('location_id', locationId)
      .eq('session_date', date)
      .maybeSingle();

    if (existing.data) return { data: existing.data, error: null };

    const result = await supabase
      .from('daily_sessions')
      .insert({ location_id: locationId, session_date: date, status: 'open' as const })
      .select(SESSION_COLS)
      .single();

    return { data: result.data, error: result.error };
  },

  async getSessionStatus(locationId: string, date?: string) {
    const d = date ?? todayISO();
    const { data } = await supabase
      .from('daily_sessions')
      .select('id, status')
      .eq('location_id', locationId)
      .eq('session_date', d)
      .maybeSingle();

    return data;
  },

  async getSessionWithEntries(sessionId: string) {
    const { data: entries, error } = await supabase
      .from('daily_product_entries')
      .select('product_id, saved_qty, discarded_qty, discard_reason, comment')
      .eq('daily_session_id', sessionId);

    return { entries: entries ?? [], error };
  },

  async upsertEntry(dailySessionId: string, productId: string, savedQty: number, discardedQty: number) {
    return supabase
      .from('daily_product_entries')
      .upsert(
        { daily_session_id: dailySessionId, product_id: productId, saved_qty: savedQty, discarded_qty: discardedQty },
        { onConflict: 'daily_session_id,product_id' }
      )
      .select('id, product_id, saved_qty, discarded_qty')
      .single();
  },

  async upsertSingleEntry(
    dailySessionId: string,
    productId: string,
    savedQty: number,
    discardedQty: number,
    comment?: string | null
  ) {
    // El comentario solo se toca si viene definido (undefined = conservar)
    const payload: {
      daily_session_id: string;
      product_id: string;
      saved_qty: number;
      discarded_qty: number;
      comment?: string | null;
    } = {
      daily_session_id: dailySessionId,
      product_id: productId,
      saved_qty: savedQty,
      discarded_qty: discardedQty,
    };
    if (comment !== undefined) payload.comment = comment || null;

    return supabase
      .from('daily_product_entries')
      .upsert(payload, { onConflict: 'daily_session_id,product_id' })
      .select('id, product_id, saved_qty, discarded_qty, comment')
      .single();
  },

  async closeSession(sessionId: string) {
    return supabase.from('daily_sessions').update({ status: 'closed' as const }).eq('id', sessionId);
  },

  async reopenSession(sessionId: string) {
    return supabase.from('daily_sessions').update({ status: 'open' as const }).eq('id', sessionId);
  },
};
