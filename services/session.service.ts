import { supabase } from '@/lib/supabase';

export const sessionService = {
  async openSession(locationId: string, date: string, _userId: string) {
    const existing = await supabase
      .from('daily_sessions')
      .select('*')
      .eq('location_id', locationId)
      .eq('session_date', date)
      .maybeSingle();

    if (existing.data) return { data: existing.data, error: null };

    return supabase
      .from('daily_sessions')
      .insert({ location_id: locationId, session_date: date, status: 'open' })
      .select('*')
      .single();
  },
  async upsertEntry(dailySessionId: string, productId: string, savedQty: number, discardedQty: number) {
    return supabase
      .from('daily_product_entries')
      .upsert(
        { daily_session_id: dailySessionId, product_id: productId, saved_qty: savedQty, discarded_qty: discardedQty },
        { onConflict: 'daily_session_id,product_id' }
      )
      .select('*')
      .single();
  },
  async closeSession(sessionId: string) {
    return supabase.from('daily_sessions').update({ status: 'closed' }).eq('id', sessionId);
  }
};
