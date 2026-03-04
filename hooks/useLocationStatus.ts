import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

export type SessionStatus = 'none' | 'open' | 'closed';

interface LocationSessionInfo {
  sessionId: string | null;
  status: SessionStatus;
  entryCount: number;
  totalProducts: number;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function useLocationStatus(locationId: string | undefined) {
  const [info, setInfo] = useState<LocationSessionInfo>({
    sessionId: null,
    status: 'none',
    entryCount: 0,
    totalProducts: 0,
  });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);

    const date = todayISO();

    // Get today's session for this location
    const { data: session } = await supabase
      .from('daily_sessions')
      .select('id, status')
      .eq('location_id', locationId)
      .eq('session_date', date)
      .maybeSingle();

    // Count entries if session exists
    let entryCount = 0;
    if (session) {
      const { count } = await supabase
        .from('daily_product_entries')
        .select('id', { count: 'exact', head: true })
        .eq('daily_session_id', session.id);
      entryCount = count ?? 0;
    }

    // Total active products
    const { count: totalProducts } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);

    setInfo({
      sessionId: session?.id ?? null,
      status: session ? (session.status as SessionStatus) : 'none',
      entryCount,
      totalProducts: totalProducts ?? 0,
    });
    setLoading(false);
  }, [locationId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...info, loading, refresh };
}
