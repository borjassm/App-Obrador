import { useCallback, useEffect, useRef, useState } from 'react';

import { useSession } from '@/hooks/useSession';
import { leftoversDayISO } from '@/lib/workday';
import { sessionService } from '@/services/session.service';
import { productService, type Product, type ProductGroup } from '@/services/product.service';

export interface ProductEntry {
  product: Product;
  savedQty: number;
  discardedQty: number;
  comment: string;
  dirty: boolean;
  /** Ya existe una fila en BD para este producto y día */
  inDb: boolean;
}

interface UseProductEntriesReturn {
  sessionId: string | null;
  sessionStatus: string;
  dayISO: string;
  groups: ProductGroup[];
  entries: Map<string, ProductEntry>;
  loading: boolean;
  saving: boolean;
  dirtyCount: number;
  updateEntry: (productId: string, value: number) => void;
  updateDiscarded: (productId: string, value: number) => void;
  updateComment: (productId: string, value: string) => void;
  saveAll: () => Promise<{ error: string | null }>;
  closeDay: () => Promise<{ error: Error | null }>;
  reopenDay: () => Promise<{ error: Error | null }>;
  refresh: () => Promise<void>;
  addCustomProduct: (name: string, family: string) => Promise<{ error: string | null }>;
  totalSobrantes: number;
  totalDescartado: number;
  filledCount: number;
  totalCount: number;
}

function isEmpty(e: Pick<ProductEntry, 'savedQty' | 'discardedQty' | 'comment'>): boolean {
  return e.savedQty === 0 && e.discardedQty === 0 && e.comment.trim() === '';
}

// Registro de sobrantes. Reglas para no ensuciar la BD:
// - El día (daily_sessions) no se crea al abrir la pantalla, solo al guardar.
// - No se guardan líneas vacías (0 guardado, 0 tirado, sin comentario) salvo
//   que ya existieran (entonces se ponen a 0 para reflejar la corrección).
// - El día de trabajo cierra a las 5:00 (lib/workday).
// Los cambios se acumulan en local y se persisten juntos con saveAll().
export function useProductEntries(locationId: string): UseProductEntriesReturn {
  const { session } = useSession();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState('none');
  const [dayISO, setDayISO] = useState(() => leftoversDayISO());
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [entries, setEntries] = useState<Map<string, ProductEntry>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const entriesRef = useRef(entries);
  useEffect(() => { entriesRef.current = entries; }, [entries]);
  const sessionIdRef = useRef(sessionId);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  // Ubicación+día a los que pertenecen las entradas en memoria (la pantalla
  // sigue montada al cambiar de tienda o al pasar el corte de las 5:00)
  const loadedKeyRef = useRef<string | null>(null);

  const load = useCallback(async (showSpinner: boolean) => {
    if (!locationId || !session?.user.id) return;
    const day = leftoversDayISO();
    const key = `${locationId}_${day}`;
    const keyChanged = loadedKeyRef.current !== key;
    if (keyChanged) {
      entriesRef.current = new Map();
      setEntries(new Map());
    }
    if (showSpinner || keyChanged) setLoading(true);
    setDayISO(day);

    const [existingSession, productGroups] = await Promise.all([
      sessionService.getSessionStatus(locationId, day),
      productService.listGroupedByFamily(),
    ]);
    setSessionId(existingSession?.id ?? null);
    setSessionStatus(existingSession?.status ?? 'none');
    setGroups(productGroups);

    const existingEntries = existingSession
      ? (await sessionService.getSessionWithEntries(existingSession.id)).entries
      : [];

    // Sin pisar cambios locales pendientes de guardar
    const prevEntries = entriesRef.current;
    const entryMap = new Map<string, ProductEntry>();
    for (const product of productGroups.flatMap((g) => g.products)) {
      const existing = existingEntries.find((e) => e.product_id === product.id);
      const local = prevEntries.get(product.id);
      if (local?.dirty) {
        entryMap.set(product.id, { ...local, inDb: !!existing });
        continue;
      }
      entryMap.set(product.id, {
        product,
        savedQty: existing?.saved_qty ?? 0,
        discardedQty: existing?.discarded_qty ?? 0,
        comment: existing?.comment ?? '',
        dirty: false,
        inDb: !!existing,
      });
    }

    loadedKeyRef.current = key;
    setEntries(entryMap);
    setLoading(false);
  }, [locationId, session?.user.id]);

  useEffect(() => {
    load(true);
  }, [load]);

  const refresh = useCallback(async () => {
    await load(false);
  }, [load]);

  const patchEntry = useCallback((productId: string, patch: Partial<ProductEntry>) => {
    setEntries((prev) => {
      const entry = prev.get(productId);
      if (!entry) return prev;
      const next = new Map(prev);
      next.set(productId, { ...entry, ...patch, dirty: true });
      return next;
    });
  }, []);

  const updateEntry = useCallback(
    (productId: string, value: number) => patchEntry(productId, { savedQty: value }),
    [patchEntry]
  );

  const updateDiscarded = useCallback(
    (productId: string, value: number) => patchEntry(productId, { discardedQty: value }),
    [patchEntry]
  );

  const updateComment = useCallback(
    (productId: string, value: string) => patchEntry(productId, { comment: value }),
    [patchEntry]
  );

  // Devuelve el id del día, creándolo si aún no existe
  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (sessionIdRef.current) return sessionIdRef.current;
    if (!session?.user.id) return null;
    const { data } = await sessionService.openSession(locationId, dayISO, session.user.id);
    if (!data) return null;
    sessionIdRef.current = data.id;
    setSessionId(data.id);
    setSessionStatus(data.status);
    return data.id;
  }, [locationId, dayISO, session?.user.id]);

  // Persiste las entradas con cambios pendientes
  const saveAll = useCallback(async (): Promise<{ error: string | null }> => {
    const pending = [...entriesRef.current.entries()].filter(([, e]) => e.dirty);
    if (pending.length === 0) return { error: null };

    // Líneas vacías que nunca se guardaron: basta con limpiar su marca
    const toWrite = pending.filter(([, e]) => !(isEmpty(e) && !e.inDb));
    const skipped = pending.filter(([, e]) => isEmpty(e) && !e.inDb).map(([id]) => id);

    setSaving(true);
    const savedIds: string[] = [];
    let failed = false;

    if (toWrite.length > 0) {
      const sid = await ensureSession();
      if (!sid) {
        setSaving(false);
        return { error: 'No se pudo abrir el registro del día. Revisa la conexión.' };
      }
      for (const [productId, entry] of toWrite) {
        const { error } = await sessionService.upsertSingleEntry(
          sid, productId, entry.savedQty, entry.discardedQty, entry.comment
        );
        if (error) {
          failed = true;
        } else {
          savedIds.push(productId);
        }
      }
    }

    setEntries((prev) => {
      const next = new Map(prev);
      for (const id of savedIds) {
        const e = next.get(id);
        if (e) next.set(id, { ...e, dirty: false, inDb: true });
      }
      for (const id of skipped) {
        const e = next.get(id);
        if (e) next.set(id, { ...e, dirty: false });
      }
      return next;
    });
    setSaving(false);
    return { error: failed ? 'Algunos productos no se pudieron guardar. Inténtalo de nuevo.' : null };
  }, [ensureSession]);

  const closeDay = useCallback(async () => {
    const { error: saveError } = await saveAll();
    if (saveError) return { error: new Error(saveError) };

    const sid = await ensureSession();
    if (!sid) return { error: new Error('No se pudo abrir el registro del día.') };

    const { error } = await sessionService.closeSession(sid);
    if (!error) setSessionStatus('closed');
    return { error: error ? new Error(String(error)) : null };
  }, [saveAll, ensureSession]);

  const reopenDay = useCallback(async () => {
    if (!sessionId) return { error: new Error('No session') };
    const { error } = await sessionService.reopenSession(sessionId);
    if (!error) setSessionStatus('open');
    return { error: error ? new Error(String(error)) : null };
  }, [sessionId]);

  const addCustomProduct = useCallback(async (name: string, family: string) => {
    const { error } = await productService.createCustom(name, family);
    if (error) {
      const message = error.code === '23505'
        ? 'Ya existe un producto con ese nombre.'
        : 'No se pudo crear el producto.';
      return { error: message };
    }
    await load(false);
    return { error: null };
  }, [load]);

  let totalSobrantes = 0;
  let totalDescartado = 0;
  let filledCount = 0;
  let dirtyCount = 0;
  for (const entry of entries.values()) {
    totalSobrantes += entry.savedQty;
    totalDescartado += entry.discardedQty;
    if (entry.savedQty > 0 || entry.discardedQty > 0) filledCount++;
    if (entry.dirty) dirtyCount++;
  }

  return {
    sessionId,
    sessionStatus,
    dayISO,
    groups,
    entries,
    loading,
    saving,
    dirtyCount,
    updateEntry,
    updateDiscarded,
    updateComment,
    saveAll,
    closeDay,
    reopenDay,
    refresh,
    addCustomProduct,
    totalSobrantes,
    totalDescartado,
    filledCount,
    totalCount: entries.size,
  };
}
