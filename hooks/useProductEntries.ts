import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useSession } from '@/hooks/useSession';
import { isLeftoversDayEditable, leftoversDayISO, LEFTOVERS_EDIT_WINDOW_DAYS } from '@/lib/workday';
import { sessionService } from '@/services/session.service';
import { LEFTOVERS_OTHER } from '@/constants/families';
import {
  productService,
  type LeftoversSection,
  type Product,
  type ProductGroup,
} from '@/services/product.service';

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
  /** Día de trabajo actual (cambia solo a las 5:00 aunque la app siga abierta) */
  todayISO: string;
  /** El día cargado está dentro de la ventana que se puede modificar */
  editable: boolean;
  groups: ProductGroup[];
  /** Secciones donde se puede dar de alta un producto puntual */
  addableSections: string[];
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
  addCustomProduct: (name: string, section: string) => Promise<{ error: string | null }>;
  totalSobrantes: number;
  totalDescartado: number;
  filledCount: number;
  totalCount: number;
}

const DAY_LOCKED_MESSAGE =
  `Este día ya no se puede modificar: solo se pueden corregir los últimos ${LEFTOVERS_EDIT_WINDOW_DAYS} días.`;

// La RLS (0017) rechaza escribir fuera de la ventana con 42501
function isForbidden(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === '42501';
}

function isEmpty(e: Pick<ProductEntry, 'savedQty' | 'discardedQty' | 'comment'>): boolean {
  return e.savedQty === 0 && e.discardedQty === 0 && e.comment.trim() === '';
}

// Registro de sobrantes. Reglas para no ensuciar la BD:
// - El día (daily_sessions) no se crea al abrir la pantalla, solo al guardar.
// - No se guardan líneas vacías (0 guardado, 0 tirado, sin comentario) salvo
//   que ya existieran (entonces se ponen a 0 para reflejar la corrección).
// - El día de trabajo cierra a las 5:00 (lib/workday).
// - Se puede elegir un día anterior (selectedDay) dentro de la ventana de
//   LEFTOVERS_EDIT_WINDOW_DAYS; null = hoy. La BD aplica el mismo límite (0017).
// Los cambios se acumulan en local y se persisten juntos con saveAll().
export function useProductEntries(locationId: string, selectedDay: string | null = null): UseProductEntriesReturn {
  const { session } = useSession();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState('none');
  const [dayISO, setDayISO] = useState(() => selectedDay ?? leftoversDayISO());
  const [todayISO, setTodayISO] = useState(() => leftoversDayISO());
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [sections, setSections] = useState<LeftoversSection[]>([]);
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
  // Día cargado en modo "hoy" (sin día elegido) y contador de cargas
  const loadedTodayRef = useRef<string | null>(null);
  const loadReqRef = useRef(0);

  // Con la app abierta, "hoy" avanza al pasar las 5:00
  useEffect(() => {
    const tick = () => setTodayISO(leftoversDayISO());
    const timer = setInterval(tick, 60_000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);

  const load = useCallback(async (showSpinner: boolean) => {
    if (!locationId || !session?.user.id) return;
    // En "hoy", si pasan las 5:00 con cambios sin guardar, se sigue en el día
    // que se estaba contando (sigue dentro de la ventana) para no perderlos
    const hasDirty = [...entriesRef.current.values()].some((e) => e.dirty);
    const keepCountingDay = !selectedDay && hasDirty && !!loadedTodayRef.current
      && loadedKeyRef.current === `${locationId}_${loadedTodayRef.current}`;
    const day = selectedDay ?? (keepCountingDay ? loadedTodayRef.current! : leftoversDayISO());
    const key = `${locationId}_${day}`;
    const keyChanged = loadedKeyRef.current !== key;
    const req = ++loadReqRef.current;
    if (keyChanged) {
      entriesRef.current = new Map();
      setEntries(new Map());
      sessionIdRef.current = null;
      setSessionId(null);
    }
    if (showSpinner || keyChanged) setLoading(true);
    setDayISO(day);

    const [existingSession, sectionList] = await Promise.all([
      sessionService.getSessionStatus(locationId, day),
      productService.listLeftoversSections(),
    ]);
    const productGroups = await productService.listForLeftovers(sectionList);
    // Se ha cambiado de día mientras cargaba: manda la carga más reciente
    if (req !== loadReqRef.current) return;
    setSessionId(existingSession?.id ?? null);
    setSessionStatus(existingSession?.status ?? 'none');
    setSections(sectionList);
    setGroups(productGroups);

    const existingEntries = existingSession
      ? (await sessionService.getSessionWithEntries(existingSession.id)).entries
      : [];
    if (req !== loadReqRef.current) return;

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
    loadedTodayRef.current = selectedDay ? null : day;
    setEntries(entryMap);
    setLoading(false);
    // todayISO: recargar cuando cambia el día de trabajo
  }, [locationId, session?.user.id, selectedDay, todayISO]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const ensureSession = useCallback(async (): Promise<{ id: string | null; forbidden: boolean }> => {
    if (sessionIdRef.current) return { id: sessionIdRef.current, forbidden: false };
    if (!session?.user.id) return { id: null, forbidden: false };
    const { data, error } = await sessionService.openSession(locationId, dayISO, session.user.id);
    if (!data) return { id: null, forbidden: isForbidden(error) };
    sessionIdRef.current = data.id;
    setSessionId(data.id);
    setSessionStatus(data.status);
    return { id: data.id, forbidden: false };
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
    let forbidden = false;

    if (toWrite.length > 0) {
      const { id: sid, forbidden: sessionForbidden } = await ensureSession();
      if (!sid) {
        setSaving(false);
        return { error: sessionForbidden ? DAY_LOCKED_MESSAGE : 'No se pudo abrir el registro del día. Revisa la conexión.' };
      }
      for (const [productId, entry] of toWrite) {
        const { error } = await sessionService.upsertSingleEntry(
          sid, productId, entry.savedQty, entry.discardedQty, entry.comment
        );
        if (error) {
          failed = true;
          if (isForbidden(error)) forbidden = true;
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
    if (forbidden) return { error: DAY_LOCKED_MESSAGE };
    return { error: failed ? 'Algunos productos no se pudieron guardar. Inténtalo de nuevo.' : null };
  }, [ensureSession]);

  const closeDay = useCallback(async () => {
    const { error: saveError } = await saveAll();
    if (saveError) return { error: new Error(saveError) };

    const { id: sid, forbidden } = await ensureSession();
    if (!sid) return { error: new Error(forbidden ? DAY_LOCKED_MESSAGE : 'No se pudo abrir el registro del día.') };

    const { error, updated } = await sessionService.closeSession(sid);
    if (error) return { error: new Error(error.message) };
    if (!updated) return { error: new Error(DAY_LOCKED_MESSAGE) };
    setSessionStatus('closed');
    return { error: null };
  }, [saveAll, ensureSession]);

  const reopenDay = useCallback(async () => {
    if (!sessionId) return { error: new Error('No session') };
    const { error, updated } = await sessionService.reopenSession(sessionId);
    if (error) return { error: new Error(error.message) };
    if (!updated) return { error: new Error(DAY_LOCKED_MESSAGE) };
    setSessionStatus('open');
    return { error: null };
  }, [sessionId]);

  const addCustomProduct = useCallback(async (name: string, sectionName: string) => {
    const section = sections.find((s) => s.name === sectionName);
    if (!section) return { error: 'Elige una sección.' };
    const { error } = await productService.createCustom(name, section);
    if (error) {
      const message = error.code === '23505'
        ? 'Ya existe un producto con ese nombre.'
        : 'No se pudo crear el producto.';
      return { error: message };
    }
    await load(false);
    return { error: null };
  }, [load, sections]);

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
    todayISO,
    editable: isLeftoversDayEditable(dayISO),
    groups,
    addableSections: sections.map((s) => s.name).filter((n) => n !== LEFTOVERS_OTHER),
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
