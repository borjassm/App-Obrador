import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import Button from '@/components/Button';
import { Screen } from '@/components/Screen';
import Stepper from '@/components/Stepper';
import { Colors, Radius, Spacing, Typography, getFamilyColor } from '@/constants/theme';
import { getProductEmoji } from '@/constants/products';
import { supabase } from '@/lib/supabase';
import { sessionService } from '@/services/session.service';
import { useSession } from '@/hooks/useSession';

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function ProductDetail() {
  const { locationId, productId } = useLocalSearchParams<{ locationId: string; productId: string }>();
  const { session } = useSession();

  const [product, setProduct] = useState<{ name: string; family: string } | null>(null);
  const [sobrantes, setSobrantes] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sobrantesRef = useRef(0);
  const sessionIdRef = useRef<string | null>(null);

  // Keep refs in sync
  useEffect(() => {
    sobrantesRef.current = sobrantes;
  }, [sobrantes]);
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Load product info and existing entry
  useEffect(() => {
    if (!productId || !locationId || !session?.user.id) return;

    const load = async () => {
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
          .select('saved_qty')
          .eq('daily_session_id', sess.id)
          .eq('product_id', productId)
          .maybeSingle();

        if (entry) {
          setSobrantes(entry.saved_qty ?? 0);
        }
      }
    };

    load();
  }, [productId, locationId, session?.user.id]);

  // Auto-save with debounce
  const doSave = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid || !productId) return;

    setSaveStatus('saving');
    await sessionService.upsertSingleEntry(sid, productId, sobrantesRef.current, 0);
    setSaveStatus('saved');

    // Reset to idle after showing "saved"
    setTimeout(() => setSaveStatus('idle'), 1500);
  }, [productId]);

  const handleChange = useCallback((value: number) => {
    setSobrantes(value);
    setSaveStatus('idle');

    // Clear previous debounce
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Schedule save after 500ms
    debounceRef.current = setTimeout(() => {
      doSave();
    }, 500);
  }, [doSave]);

  // Cleanup debounce on unmount — save immediately if pending
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        // Fire a final save
        const sid = sessionIdRef.current;
        if (sid && productId) {
          sessionService.upsertSingleEntry(sid, productId, sobrantesRef.current, 0);
        }
      }
    };
  }, [productId]);

  const familyColor = product ? getFamilyColor(product.family) : Colors.primary;
  const emoji = product ? getProductEmoji(product.name) : '';

  if (!product) {
    return (
      <Screen>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Cargando…</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scrollable>
      {/* Product header with emoji */}
      <View style={styles.header}>
        <Text style={styles.headerEmoji}>{emoji}</Text>
        <Text style={styles.productName}>{product.name}</Text>
        <View style={[styles.familyBadge, { backgroundColor: familyColor + '20' }]}>
          <Text style={[styles.familyName, { color: familyColor }]}>
            {product.family.charAt(0).toUpperCase() + product.family.slice(1)}
          </Text>
        </View>
      </View>

      {/* Sobrantes stepper */}
      <View style={styles.sobrantesSection}>
        <Text style={styles.sobrantesLabel}>Sobrantes</Text>

        <View style={styles.display}>
          <Text style={[styles.number, { color: Colors.primary }]}>{sobrantes}</Text>
          <Text style={styles.unit}>uds</Text>
        </View>

        <Stepper value={sobrantes} onChange={handleChange} color={Colors.primary} min={0} />

        {/* Save status indicator */}
        <View style={styles.statusRow}>
          {saveStatus === 'saving' && (
            <Text style={styles.statusSaving}>Guardando…</Text>
          )}
          {saveStatus === 'saved' && (
            <Text style={styles.statusSaved}>Guardado</Text>
          )}
        </View>
      </View>

      {/* Back button */}
      <View style={styles.footer}>
        <Button
          title="Volver"
          variant="ghost"
          onPress={() => router.back()}
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
  },
  loadingText: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
  },
  header: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  headerEmoji: {
    fontSize: 56,
    marginBottom: Spacing.xs,
  },
  productName: {
    ...Typography.headingLarge,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  familyBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  familyName: {
    ...Typography.labelSmall,
  },
  sobrantesSection: {
    alignItems: 'center',
    gap: Spacing.lg,
    paddingVertical: Spacing.xl,
  },
  sobrantesLabel: {
    ...Typography.headingMedium,
    color: Colors.textPrimary,
  },
  display: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  number: {
    fontSize: 64,
    fontWeight: '700',
    lineHeight: 72,
  },
  unit: {
    ...Typography.bodyLarge,
    color: Colors.textMuted,
  },
  statusRow: {
    height: 24,
    justifyContent: 'center',
  },
  statusSaving: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
  statusSaved: {
    ...Typography.labelSmall,
    color: Colors.success,
  },
  footer: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
});
