import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { addDays, isoLocal } from '@/features/planning/pipelineScheduler';
import { teamsService, type TeamItem, type WorkEntry } from '@/services/teams.service';

export interface WorklistRow {
  item: TeamItem;
  plannedQty: number | null;
  producedQty: number | null;
  comment: string;
  dirty: boolean;
}

// Hoja de trabajo de un equipo en un lugar: hoy (producir y apuntar) y
// mañana (ver qué hay que dejar preparado/amasado). El plan llega en vivo
// desde la pestaña Plan del admin (realtime + refresco).
export function useTeamWorklist(teamId: string, locationId: string) {
  const todayISO = useMemo(() => isoLocal(new Date()), []);
  const tomorrowISO = useMemo(
    () => isoLocal(addDays(new Date(todayISO + 'T12:00:00'), 1)),
    [todayISO]
  );

  const [items, setItems] = useState<TeamItem[]>([]);
  const [entries, setEntries] = useState<Map<string, WorkEntry>>(new Map());
  const [drafts, setDrafts] = useState<Map<string, { producedQty: number | null; comment: string; dirty: boolean }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const draftsRef = useRef(drafts);
  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const load = useCallback(
    async (showSpinner: boolean) => {
      if (!teamId || !locationId) return;
      if (showSpinner) setLoading(true);

      const allItems = await teamsService.listItems(teamId);
      const localItems = allItems.filter((i) => i.locationIds.includes(locationId));
      setItems(localItems);

      const entryMap = await teamsService.entriesFor(
        localItems.map((i) => i.id),
        locationId,
        [todayISO, tomorrowISO]
      );
      setEntries(entryMap);

      // Sembrar drafts de HOY sin pisar ediciones locales pendientes
      setDrafts((prev) => {
        const next = new Map(prev);
        for (const item of localItems) {
          const key = teamsService.entryKey(item.id, locationId, todayISO);
          const local = prev.get(key);
          if (local?.dirty) continue;
          const entry = entryMap.get(key);
          next.set(key, {
            producedQty: entry?.producedQty ?? null,
            comment: entry?.comment ?? '',
            dirty: false,
          });
        }
        return next;
      });
      setLoading(false);
    },
    [teamId, locationId, todayISO, tomorrowISO]
  );

  useEffect(() => {
    load(true);
  }, [load]);

  const refresh = useCallback(async () => {
    await load(false);
  }, [load]);

  // Plan en vivo: cualquier cambio de hoy o mañana refresca la hoja
  useEffect(() => {
    const un1 = teamsService.subscribeToDate(todayISO, () => load(false));
    const un2 = teamsService.subscribeToDate(tomorrowISO, () => load(false));
    return () => {
      un1();
      un2();
    };
  }, [todayISO, tomorrowISO, load]);

  const persist = useCallback(
    async (itemId: string) => {
      const key = teamsService.entryKey(itemId, locationId, todayISO);
      const draft = draftsRef.current.get(key);
      if (!draft) return;
      setSaving(true);
      await teamsService.upsertProduced(itemId, locationId, todayISO, draft.producedQty, draft.comment);
      setDrafts((prev) => {
        const next = new Map(prev);
        const d = next.get(key);
        if (d) next.set(key, { ...d, dirty: false });
        return next;
      });
      setSaving(false);
    },
    [locationId, todayISO]
  );

  const schedulePersist = useCallback(
    (itemId: string) => {
      const key = teamsService.entryKey(itemId, locationId, todayISO);
      const timer = debounceTimers.current.get(key);
      if (timer) clearTimeout(timer);
      debounceTimers.current.set(
        key,
        setTimeout(() => {
          debounceTimers.current.delete(key);
          persist(itemId);
        }, 600)
      );
    },
    [locationId, todayISO, persist]
  );

  const setProduced = useCallback(
    (itemId: string, value: number | null) => {
      const key = teamsService.entryKey(itemId, locationId, todayISO);
      setDrafts((prev) => {
        const next = new Map(prev);
        const d = next.get(key) ?? { producedQty: null, comment: '', dirty: false };
        next.set(key, { ...d, producedQty: value, dirty: true });
        return next;
      });
      schedulePersist(itemId);
    },
    [locationId, todayISO, schedulePersist]
  );

  const setComment = useCallback(
    (itemId: string, value: string) => {
      const key = teamsService.entryKey(itemId, locationId, todayISO);
      setDrafts((prev) => {
        const next = new Map(prev);
        const d = next.get(key) ?? { producedQty: null, comment: '', dirty: false };
        next.set(key, { ...d, comment: value, dirty: true });
        return next;
      });
      schedulePersist(itemId);
    },
    [locationId, todayISO, schedulePersist]
  );

  const saveNow = useCallback(
    async (itemId: string) => {
      const key = teamsService.entryKey(itemId, locationId, todayISO);
      const timer = debounceTimers.current.get(key);
      if (timer) {
        clearTimeout(timer);
        debounceTimers.current.delete(key);
      }
      await persist(itemId);
    },
    [locationId, todayISO, persist]
  );

  useEffect(() => {
    const timers = debounceTimers.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
    };
  }, []);

  // Filas de hoy (plan + producido) y de mañana (solo lo planificado)
  const todayRows: WorklistRow[] = useMemo(
    () =>
      items.map((item) => {
        const key = teamsService.entryKey(item.id, locationId, todayISO);
        const entry = entries.get(key);
        const draft = drafts.get(key);
        return {
          item,
          plannedQty: entry?.plannedQty ?? null,
          producedQty: draft?.producedQty ?? entry?.producedQty ?? null,
          comment: draft?.comment ?? entry?.comment ?? '',
          dirty: draft?.dirty ?? false,
        };
      }),
    [items, entries, drafts, locationId, todayISO]
  );

  const tomorrowPlanned = useMemo(
    () =>
      items
        .map((item) => {
          const entry = entries.get(teamsService.entryKey(item.id, locationId, tomorrowISO));
          return { item, plannedQty: entry?.plannedQty ?? null };
        })
        .filter((r) => r.plannedQty != null && r.plannedQty > 0),
    [items, entries, locationId, tomorrowISO]
  );

  return {
    todayISO,
    tomorrowISO,
    loading,
    saving,
    todayRows,
    tomorrowPlanned,
    setProduced,
    setComment,
    saveNow,
    refresh,
  };
}
