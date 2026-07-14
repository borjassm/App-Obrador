import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

import Button from '@/components/Button';
import QuantityDisplay from '@/components/QuantityDisplay';
import { Screen } from '@/components/Screen';
import {
  Colors,
  Fonts,
  Radius,
  Spacing,
  Typography,
  getFamilyTint,
} from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { productService, type Product } from '@/services/product.service';
import { sessionService } from '@/services/session.service';
import { useSession } from '@/hooks/useSession';

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type SaveStatus = 'idle' | 'saving' | 'saved';

export default function ProductDetail() {
  const { locationId, productId } = useLocalSearchParams<{ locationId: string; productId: string }>();
  const { session } = useSession();

  const [product, setProduct] = useState<{ name: string; family: string } | null>(null);
  const [savedQty, setSavedQty] = useState(0);
  const [discardedQty, setDiscardedQty] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [orderedProducts, setOrderedProducts] = useState<Product[]>([]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRef = useRef(0);
  const discardedRef = useRef(0);
  const sessionIdRef = useRef<string | null>(null);

  // Keep refs in sync
  useEffect(() => { savedRef.current = savedQty; }, [savedQty]);
  useEffect(() => { discardedRef.current = discardedQty; }, [discardedQty]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

  // Lista ordenada de productos (para "X de Y" y "Siguiente")
  useEffect(() => {
    productService.listGroupedByFamily().then((groups) => {
      setOrderedProducts(groups.flatMap((g) => g.products));
    });
  }, []);

  // Load product info and existing entry
  useEffect(() => {
    if (!productId || !locationId || !session?.user.id) return;

    const load = async () => {
      // Reset al cambiar de producto
      setProduct(null);
      setSavedQty(0);
      setDiscardedQty(0);
      setSaveStatus('idle');

      // Get product details
      const { data: prod } = await supabase
        .from('products')
        .select('name, family')
        .eq('id', productId)
        .single();
      if (prod) setProduct({ name: prod.name, family: prod.family ?? 'otros' });

      // Get or create session
      const { data: sess } = await sessionService.openSession(locationId, todayISO(), session.user.id);
      if (sess) {
        setSessionId(sess.id);

        // Load existing entry
        const { data: entry } = await supabase
          .from('daily_product_entries')
          .select('saved_qty, discarded_qty')
          .eq('daily_session_id', sess.id)
          .eq('product_id', productId)
          .maybeSingle();

        if (entry) {
          setSavedQty(entry.saved_qty ?? 0);
          setDiscardedQty(entry.discarded_qty ?? 0);
        }
      }
    };

    load();
  }, [productId, locationId, session?.user.id]);

  // Auto-save with debounce (saves both saved + discarded)
  const doSave = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid || !productId) return;

    setSaveStatus('saving');
    await sessionService.upsertSingleEntry(sid, productId, savedRef.current, discardedRef.current);
    setSaveStatus('saved');

    // Reset to idle after showing "saved"
    setTimeout(() => setSaveStatus('idle'), 1500);
  }, [productId]);

  const scheduleSave = useCallback(() => {
    setSaveStatus('idle');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { doSave(); }, 500);
  }, [doSave]);

  const handleSavedChange = useCallback((value: number) => {
    setSavedQty(value);
    scheduleSave();
  }, [scheduleSave]);

  const handleDiscardedChange = useCallback((value: number) => {
    setDiscardedQty(value);
    scheduleSave();
  }, [scheduleSave]);

  // Cleanup debounce on unmount / cambio de producto — save immediately if pending
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        const sid = sessionIdRef.current;
        if (sid && productId) {
          sessionService.upsertSingleEntry(sid, productId, savedRef.current, discardedRef.current);
        }
      }
    };
  }, [productId]);

  // Posición en la lista y siguiente producto
  const { position, total, nextId } = useMemo(() => {
    const idx = orderedProducts.findIndex((p) => p.id === productId);
    return {
      position: idx >= 0 ? idx + 1 : 0,
      total: orderedProducts.length,
      nextId: idx >= 0 && idx < orderedProducts.length - 1 ? orderedProducts[idx + 1].id : null,
    };
  }, [orderedProducts, productId]);

  const handleNext = () => {
    if (nextId) {
      router.setParams({ productId: nextId });
    } else {
      router.back();
    }
  };

  if (!product) {
    return (
      <Screen>
        <View style={styles.loading}>
          <MaterialIcons name="hourglass-empty" size={48} color={Colors.textMuted} />
          <Text style={styles.loadingText}>Cargando…</Text>
        </View>
      </Screen>
    );
  }

  const chipSaving = saveStatus === 'saving';
  const chipSaved = saveStatus === 'saved';

  return (
    <Screen scrollable>
      {/* Top bar: back circular + contador + chip de guardado */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          hitSlop={8}
        >
          <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>

        <Text style={styles.counter}>
          {position > 0 ? `${position} de ${total}` : ''}
        </Text>

        <View
          style={[
            styles.saveChip,
            { backgroundColor: chipSaved ? Colors.successLight : Colors.borderLight },
          ]}
        >
          <MaterialIcons
            name={chipSaving ? 'cloud-upload' : 'cloud-done'}
            size={16}
            color={chipSaved ? Colors.success : Colors.textSecondary}
          />
          <Text
            style={[
              styles.saveChipText,
              { color: chipSaved ? Colors.success : Colors.textSecondary },
            ]}
          >
            {chipSaving ? 'Guardando…' : chipSaved ? 'Guardado' : 'Autoguardado'}
          </Text>
        </View>
      </View>

      {/* Cabecera de producto: chip de familia + nombre */}
      <View style={styles.header}>
        <View style={[styles.familyChip, { backgroundColor: getFamilyTint(product.family) }]}>
          <Text style={styles.familyChipText}>{product.family}</Text>
        </View>
        <Text style={styles.productName}>{product.name}</Text>
      </View>

      {/* Guardado (para mañana) */}
      <QuantityDisplay
        label="Guardado"
        hint="Se guarda para vender mañana"
        icon="archive"
        value={savedQty}
        onChange={handleSavedChange}
        color={Colors.primary}
        tint={Colors.primaryTint}
        size="counter"
      />

      {/* Tirado / Merma */}
      <QuantityDisplay
        label="Tirado / Merma"
        hint="Se desecha (pérdida)"
        icon="delete"
        value={discardedQty}
        onChange={handleDiscardedChange}
        color={Colors.danger}
        tint={Colors.dangerLight}
        size="counter"
      />

      {/* Footer: volver + siguiente */}
      <View style={styles.footer}>
        <Button
          title="Volver"
          variant="ghost"
          onPress={() => router.back()}
          style={styles.footerBack}
        />
        <Button
          title={nextId ? 'Siguiente' : 'Finalizar'}
          onPress={handleNext}
          style={styles.footerNext}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    ...Typography.labelMedium,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    flex: 1,
  },
  saveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  saveChipText: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    lineHeight: 16,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  familyChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  familyChipText: {
    fontFamily: Fonts.extraBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: Colors.textPrimary,
  },
  productName: {
    fontFamily: Fonts.extraBold,
    fontSize: 24,
    lineHeight: 30,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  footerBack: {
    flex: 1,
  },
  footerNext: {
    flex: 3,
    minHeight: 58,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
