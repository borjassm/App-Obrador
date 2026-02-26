import { useEffect, useMemo, useState } from 'react';

import { locationService } from '@/services/location.service';
import { productService } from '@/services/product.service';
import { sessionService } from '@/services/session.service';

type EntryDraft = { productId: string; productName: string; savedQty: string; discardedQty: string };

const toISODate = (d: Date) => d.toISOString().slice(0, 10);

export const useCloseSessionForm = () => {
  const [date, setDate] = useState(toISODate(new Date()));
  const [locationId, setLocationId] = useState<string>('');
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [entries, setEntries] = useState<EntryDraft[]>([]);

  useEffect(() => {
    locationService.listAll().then(({ data }) => {
      const mapped = (data ?? []).map((x) => ({ id: x.id, name: x.name }));
      setLocations(mapped);
      if (mapped.length) setLocationId(mapped[0].id);
    });

    productService.list().then(({ data }) => {
      setEntries((data ?? []).map((p) => ({ productId: p.id, productName: p.name, savedQty: '0', discardedQty: '0' })));
    });
  }, []);

  const updateQty = (productId: string, field: 'savedQty' | 'discardedQty', value: string) => {
    setEntries((prev) => prev.map((e) => (e.productId === productId ? { ...e, [field]: value } : e)));
  };

  const canSubmit = useMemo(() => !!locationId && entries.length > 0, [locationId, entries.length]);

  const submit = async (userId: string) => {
    const { data: session, error: sessionError } = await sessionService.openSession(locationId, date, userId);
    if (sessionError || !session) return { error: sessionError ?? new Error('No session') };

    for (const entry of entries) {
      const { error } = await sessionService.upsertEntry(
        session.id,
        entry.productId,
        Number(entry.savedQty) || 0,
        Number(entry.discardedQty) || 0
      );
      if (error) return { error };
    }

    return { error: null };
  };

  return { date, setDate, locationId, setLocationId, locations, entries, updateQty, canSubmit, submit };
};
