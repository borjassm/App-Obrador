import { useCallback, useEffect, useState } from 'react';

import { leftoversDayISO } from '@/lib/workday';
import { supabase } from '@/lib/supabase';

// none   → nadie ha guardado sobrantes hoy
// open   → hay sobrantes guardados (cuenta como registrado aunque no se cierre)
// closed → alguien pulsó "Cerrar el día"
export type SessionStatus = 'none' | 'open' | 'closed';

interface LocationSessionInfo {
  sessionId: string | null;
  status: SessionStatus;
  entryCount: number;
  totalProducts: number;
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

    const { data: session } = await supabase
      .from('daily_sessions')
      .select('id, status')
      .eq('location_id', locationId)
      .eq('session_date', leftoversDayISO())
      .maybeSingle();

    // Solo cuentan los productos con algo guardado o tirado (las líneas a
    // cero y los días abiertos sin datos no significan "registrado")
    let entryCount = 0;
    if (session) {
      const { count } = await supabase
        .from('daily_product_entries')
        .select('id', { count: 'exact', head: true })
        .eq('daily_session_id', session.id)
        .or('saved_qty.gt.0,discarded_qty.gt.0');
      entryCount = count ?? 0;
    }

    const { count: totalProducts } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('is_obrador', true);

    const status: SessionStatus =
      session?.status === 'closed' ? 'closed' : entryCount > 0 ? 'open' : 'none';

    setInfo({
      sessionId: session?.id ?? null,
      status,
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
