import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

import CollapsibleSection, { configureCollapseAnimation } from '@/components/CollapsibleSection';
import FilterPills from '@/components/FilterPills';
import { Screen } from '@/components/Screen';
import { Colors, Fonts, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { getLocationDisplay } from '@/constants/locations';
import { isoLocal } from '@/features/planning/pipelineScheduler';
import { supabase } from '@/lib/supabase';
import { productService, type ProductGroup } from '@/services/product.service';
import { shipmentsService } from '@/services/shipments.service';

interface LocationRow {
  id: string;
  name: string;
}

function parseQty(text: string): number | null {
  const clean = text.trim().replace(',', '.');
  if (clean === '') return null;
  const n = parseFloat(clean);
  return Number.isNaN(n) || n <= 0 ? null : n;
}

export default function NewShipmentScreen() {
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [originId, setOriginId] = useState<string | null>(null);
  const [destId, setDestId] = useState<string | null>(null);
  const [trip, setTrip] = useState<'1' | '2'>('1');
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [quantities, setQuantities] = useState<Map<string, string>>(new Map());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: locs } = await supabase
        .from('locations')
        .select('id,name')
        .eq('is_active', true)
        .order('name');
      const rows = locs ?? [];
      setLocations(rows);
      // Origen por defecto: La Nave (donde se produce)
      const nave = rows.find((l) => l.name === 'LOS URQUIZA 17');
      setOriginId(nave?.id ?? rows[0]?.id ?? null);
      const firstDest = rows.find((l) => l.id !== (nave?.id ?? rows[0]?.id));
      setDestId(firstDest?.id ?? null);

      setGroups(await productService.listGroupedByFamily());
    })();
  }, []);

  const destOptions = useMemo(
    () => locations.filter((l) => l.id !== originId),
    [locations, originId]
  );

  useEffect(() => {
    // Si el destino coincide con el nuevo origen, saltar al siguiente
    if (destId && destId === originId) {
      setDestId(destOptions[0]?.id ?? null);
    }
  }, [originId, destId, destOptions]);

  const toggleFamily = (family: string) => {
    configureCollapseAnimation();
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(family)) {
        next.delete(family);
      } else {
        next.add(family);
      }
      return next;
    });
  };

  const lines = useMemo(() => {
    const result: { productId: string; qtySent: number }[] = [];
    for (const [productId, text] of quantities) {
      const qty = parseQty(text);
      if (qty != null) result.push({ productId, qtySent: qty });
    }
    return result;
  }, [quantities]);

  const totalUnits = lines.reduce((s, l) => s + l.qtySent, 0);

  const handleCreate = async () => {
    if (!originId || !destId || lines.length === 0 || saving) return;
    setSaving(true);
    const { error } = await shipmentsService.create(
      originId,
      destId,
      parseInt(trip, 10),
      isoLocal(new Date()),
      lines
    );
    setSaving(false);
    if (error) {
      Alert.alert('Error', error);
      return;
    }
    router.back();
  };

  return (
    <Screen noPadding>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            hitSlop={8}
          >
            <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.topTitle}>Nuevo envío</Text>
        </View>

        <Text style={styles.fieldLabel}>Origen</Text>
        {originId && (
          <FilterPills
            options={locations.map((l) => ({ key: l.id, label: getLocationDisplay(l.name).shortName }))}
            selected={originId}
            onSelect={setOriginId}
          />
        )}

        <Text style={styles.fieldLabel}>Destino</Text>
        {destId && (
          <FilterPills
            options={destOptions.map((l) => ({ key: l.id, label: getLocationDisplay(l.name).shortName }))}
            selected={destId}
            onSelect={setDestId}
          />
        )}

        <Text style={styles.fieldLabel}>Viaje</Text>
        <FilterPills
          options={[
            { key: '1', label: 'Viaje 1' },
            { key: '2', label: 'Viaje 2' },
          ]}
          selected={trip}
          onSelect={(k) => setTrip(k as '1' | '2')}
        />

        <Text style={styles.hint}>
          Abre una familia y apunta las cantidades que van en el reparto. Solo se guardan las que
          rellenes.
        </Text>

        <View style={styles.families}>
          {groups.map((group) => {
            const filled = group.products.filter(
              (p) => parseQty(quantities.get(p.id) ?? '') != null
            ).length;
            return (
              <CollapsibleSection
                key={group.family}
                title={group.family}
                family={group.family}
                meta={filled > 0 ? `${filled} en el envío` : `${group.products.length} productos`}
                metaDone={filled > 0}
                expanded={expanded.has(group.family)}
                onToggle={() => toggleFamily(group.family)}
              >
                {group.products.map((product) => (
                  <View key={product.id} style={styles.productRow}>
                    <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
                    <TextInput
                      value={quantities.get(product.id) ?? ''}
                      onChangeText={(t) =>
                        setQuantities((prev) => new Map(prev).set(product.id, t))
                      }
                      keyboardType="decimal-pad"
                      placeholder="—"
                      placeholderTextColor={Colors.textMuted}
                      style={styles.qtyInput}
                    />
                  </View>
                ))}
              </CollapsibleSection>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.totalLine}>
          {lines.length} productos · {totalUnits.toLocaleString('es-ES')} uds
        </Text>
        <Pressable
          onPress={handleCreate}
          disabled={lines.length === 0 || saving}
          style={({ pressed }) => [
            styles.saveCta,
            pressed && styles.pressed,
            (lines.length === 0 || saving) && styles.disabled,
          ]}
        >
          <MaterialIcons name="local-shipping" size={20} color={Colors.textOnPrimary} />
          <Text style={styles.saveCtaText}>{saving ? 'Creando…' : 'Crear envío'}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xxl,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
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
  topTitle: {
    ...Typography.displayMedium,
    color: Colors.textPrimary,
  },
  fieldLabel: {
    ...Typography.sectionLabel,
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.md,
  },
  hint: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.md,
  },
  families: {
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.md,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 52,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingHorizontal: Spacing.lg,
  },
  productName: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    flex: 1,
  },
  qtyInput: {
    width: 76,
    minHeight: 40,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    paddingHorizontal: Spacing.sm,
    textAlign: 'right',
    fontFamily: Fonts.extraBold,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  totalLine: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    flex: 1,
    fontVariant: ['tabular-nums'],
  },
  saveCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 56,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    ...Shadows.cta,
  },
  saveCtaText: {
    ...Typography.labelLarge,
    color: Colors.textOnPrimary,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.4,
  },
});
