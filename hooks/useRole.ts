import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/useSession';

export type Role = 'admin' | 'empleado';

// Cache en memoria: el rol no cambia durante la sesión y lo consultan varias
// pantallas a la vez
let cachedRole: { userId: string; role: Role } | null = null;

export function useRole(): { role: Role; isAdmin: boolean; loading: boolean } {
  const { session } = useSession();
  const userId = session?.user.id;
  const [role, setRole] = useState<Role | null>(
    userId && cachedRole?.userId === userId ? cachedRole.role : null
  );

  useEffect(() => {
    if (!userId) return;
    if (cachedRole?.userId === userId) {
      setRole(cachedRole.role);
      return;
    }
    let cancelled = false;
    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        // Sin fila = empleado (el valor seguro por defecto)
        const resolved = (data?.role as Role | undefined) ?? 'empleado';
        cachedRole = { userId, role: resolved };
        setRole(resolved);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { role: role ?? 'empleado', isAdmin: role === 'admin', loading: role === null };
}
