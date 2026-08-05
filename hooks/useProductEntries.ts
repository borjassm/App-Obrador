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
  updateEntry: (productId: string, value: number) => void;
  updateDiscarded: (productId: string, value: number) => void;
  updateComment: (productId: string, value: string) => void;
  saveEntry: (productId: string) => Promise<void>;
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

export function useProductEntries(locationId: string): UseProductEntriesReturn {
  const { session } = useSession();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState('none');
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [entries, setEntries] = useState<Map<string, ProductEntry>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Debounce refs for auto-save
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const entriesRef = useRef(entries);
  const sessionIdRef = useRef(sessionId);

  useEffect(() => { entriesRef.current = entries; }, [entries]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

  const load = useCallback(async (showSpinner: boolean) => {
    if (!locationId || !session?.user.id) return;
    if (showSpinner) setLoading(true);

    // Ensure session exists
    const { data: sess } = await sessionService.openSession(locationId, todayISO(), session.user.id);
    if (!sess) {
      setLoading(false);
      return;
    }
    setSessionId(sess.id);
    setSessionStatus(sess.status);

    // Load products grouped by family
    const productGroups = await productService.listGroupedByFamily();
    setGroups(productGroups);

    // Load existing entries
    const { entries: existingEntries } = await sessionService.getSessionWithEntries(sess.id);

    // Build entries map — sin pisar cambios locales pendientes de guardar
    const prevEntries = entriesRef.current;
    const entryMap = new Map<string, ProductEntry>();
    const allProducts = productGroups.flatMap((g) => g.products);

    for (const product of allProducts) {
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

    setEntries(entryMap);
    setLoading(false);
  }, [locationId, session?.user.id]);

  // Initialize: ensure session exists and load products + existing entries
  useEffect(() => {
    load(true);
  }, [load]);

  // Recarga silenciosa (al recuperar el foco: otra pantalla pudo guardar datos)
  const refresh = useCallback(async () => {
    await load(false);
  }, [load]);

  // Persist one product's entry (saved + discarded) after a debounce
  const scheduleUpsert = useCallback((productId: string) => {
    const existingTimer = debounceTimers.current.get(productId);
    if (existingTimer) clearTimeout(existingTimer);

    debounceTimers.current.set(productId, setTimeout(async () => {
      const sid = sessionIdRef.current;
      const currentEntries = entriesRef.current;
      const entry = currentEntries.get(productId);
      if (!sid || !entry) return;

      setSaving(true);
      await sessionService.upsertSingleEntry(
        sid, productId, entry.savedQty, entry.discardedQty, entry.comment
      );

      setEntries((prev) => {
        const next = new Map(prev);
        const e = next.get(productId);
        if (e) next.set(productId, { ...e, dirty: false });
        return next;
      });
      setSaving(false);
      debounceTimers.current.delete(productId);
    }, 500));
  }, []);

  // Update saved value and schedule auto-save with debounce
  const updateEntry = useCallback((productId: string, value: number) => {
    setEntries((prev) => {
      const next = new Map(prev);
      const entry = next.get(productId);
      if (entry) {
        next.set(productId, { ...entry, savedQty: value, dirty: true });
      }
      return next;
    });
    scheduleUpsert(productId);
  }, [scheduleUpsert]);

  // Update discarded value and schedule auto-save with debounce
  const updateDiscarded = useCallback((productId: string, value: number) => {
    setEntries((prev) => {
      const next = new Map(prev);
      const entry = next.get(productId);
      if (entry) {
        next.set(productId, { ...entry, discardedQty: value, dirty: true });
      }
      return next;
    });
    scheduleUpsert(productId);
  }, [scheduleUpsert]);

  const updateComment = useCallback((productId: string, value: string) => {
    setEntries((prev) => {
      const next = new Map(prev);
      const entry = next.get(productId);
      if (entry) {
        next.set(productId, { ...entry, comment: value, dirty: true });
      }
      return next;
    });
    scheduleUpsert(productId);
  }, [scheduleUpsert]);

  // Guardado inmediato y explícito (botón "Guardar"): cancela el debounce y
  // persiste ya, aunque la entrada no esté marcada como dirty
  const saveEntry = useCallback(async (productId: string) => {
    const sid = sessionIdRef.current;
    const entry = entriesRef.current.get(productId);
    if (!sid || !entry) return;

    const timer = debounceTimers.current.get(productId);
    if (timer) {
      clearTimeout(timer);
      debounceTimers.current.delete(productId);
    }

    setSaving(true);
    await sessionService.upsertSingleEntry(
      sid, productId, entry.savedQty, entry.discardedQty, entry.comment
    );

    setEntries((prev) => {
      const next = new Map(prev);
      const e = next.get(productId);
      if (e) next.set(productId, { ...e, dirty: false });
      return next;
    });
    setSaving(false);
  }, []);

  const closeDay = useCallback(async () => {
    if (!sessionId) return { error: new Error('No session') };

    // Save all dirty entries first
    for (const [productId, entry] of entries) {
      if (entry.dirty) {
        await sessionService.upsertSingleEntry(
          sessionId, productId, entry.savedQty, entry.discardedQty, entry.comment
        );
      }
    }

    const { error } = await sessionService.closeSession(sessionId);
    if (!error) setSessionStatus('closed');
    return { error: error ? new Error(String(error)) : null };
  }, [sessionId, entries]);

  const reopenDay = useCallback(async () => {
    if (!sessionId) return { error: new Error('No session') };
    const { error } = await sessionService.reopenSession(sessionId);
    if (!error) setSessionStatus('open');
    return { error: error ? new Error(String(error)) : null };
  }, [sessionId]);

  // Producto puntual añadido a mano desde el cierre
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

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      for (const timer of debounceTimers.current.values()) {
        clearTimeout(timer);
      }
    };
  }, []);

  // Computed
  let totalSobrantes = 0;
  let totalDescartado = 0;
  let filledCount = 0;
  for (const entry of entries.values()) {
    totalSobrantes += entry.savedQty;
    totalDescartado += entry.discardedQty;
    if (entry.savedQty > 0 || entry.discardedQty > 0) filledCount++;
  }

  return {
    sessionId,
    sessionStatus,
    groups,
    entries,
    loading,
    saving,
    updateEntry,
    updateDiscarded,
    updateComment,
    saveEntry,
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
