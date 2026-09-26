import { useCallback, useEffect, useRef, useState } from 'react';

import { useSession } from '@/hooks/useSession';
import { sessionService } from '@/services/session.service';
import { productService, type Product, type ProductGroup } from '@/services/product.service';

export interface ProductEntry {
  product: Product;
  savedQty: number;
  discardedQty: number;
  comment: string;
  dirty: boolean;
}

interface UseProductEntriesReturn {
  sessionId: string | null;
  sessionStatus: string;
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

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Registro de sobrantes: los cambios se acumulan en local (marcados dirty) y
// se persisten todos juntos con saveAll() — el botón "Guardar" de la lista.
export function useProductEntries(locationId: string): UseProductEntriesReturn {
  const { session } = useSession();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState('none');
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [entries, setEntries] = useState<Map<string, ProductEntry>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const entriesRef = useRef(entries);
  useEffect(() => { entriesRef.current = entries; }, [entries]);
  // Ubicación a la que pertenecen las entradas en memoria (la pantalla sigue
  // montada al cambiar de tienda: no arrastrar cambios de otra ubicación)
  const loadedLocationRef = useRef<string | null>(null);

  const load = useCallback(async (showSpinner: boolean) => {
    if (!locationId || !session?.user.id) return;
    const locationChanged = loadedLocationRef.current !== locationId;
    if (locationChanged) {
      entriesRef.current = new Map();
      setEntries(new Map());
    }
    if (showSpinner || locationChanged) setLoading(true);

    const { data: sess } = await sessionService.openSession(locationId, todayISO(), session.user.id);
    if (!sess) {
      setLoading(false);
      return;
    }
    setSessionId(sess.id);
    setSessionStatus(sess.status);

    const productGroups = await productService.listGroupedByFamily();
    setGroups(productGroups);

    const { entries: existingEntries } = await sessionService.getSessionWithEntries(sess.id);

    // Sin pisar cambios locales pendientes de guardar
    const prevEntries = entriesRef.current;
    const entryMap = new Map<string, ProductEntry>();
    for (const product of productGroups.flatMap((g) => g.products)) {
      const local = prevEntries.get(product.id);
      if (local?.dirty) {
        entryMap.set(product.id, local);
        continue;
      }
      const existing = existingEntries.find((e) => e.product_id === product.id);
      entryMap.set(product.id, {
        product,
        savedQty: existing?.saved_qty ?? 0,
        discardedQty: existing?.discarded_qty ?? 0,
        comment: existing?.comment ?? '',
        dirty: false,
      });
    }

    loadedLocationRef.current = locationId;
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

  // Persiste todas las entradas con cambios pendientes
  const saveAll = useCallback(async (): Promise<{ error: string | null }> => {
    if (!sessionId) return { error: 'No hay sesión abierta.' };
    const pending = [...entriesRef.current.entries()].filter(([, e]) => e.dirty);
    if (pending.length === 0) return { error: null };

    setSaving(true);
    const savedIds: string[] = [];
    let failed = false;
    for (const [productId, entry] of pending) {
      const { error } = await sessionService.upsertSingleEntry(
        sessionId, productId, entry.savedQty, entry.discardedQty, entry.comment
      );
      if (error) {
        failed = true;
      } else {
        savedIds.push(productId);
      }
    }

    setEntries((prev) => {
      const next = new Map(prev);
      for (const id of savedIds) {
        const e = next.get(id);
        if (e) next.set(id, { ...e, dirty: false });
      }
      return next;
    });
    setSaving(false);
    return { error: failed ? 'Algunos productos no se pudieron guardar. Inténtalo de nuevo.' : null };
  }, [sessionId]);

  const closeDay = useCallback(async () => {
    if (!sessionId) return { error: new Error('No session') };

    const { error: saveError } = await saveAll();
    if (saveError) return { error: new Error(saveError) };

    const { error } = await sessionService.closeSession(sessionId);
    if (!error) setSessionStatus('closed');
    return { error: error ? new Error(String(error)) : null };
  }, [sessionId, saveAll]);

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
