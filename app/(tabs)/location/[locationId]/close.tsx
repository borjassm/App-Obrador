import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

import Button from '@/components/Button';
import CollapsibleSection, { configureCollapseAnimation } from '@/components/CollapsibleSection';
import ConfirmSheet from '@/components/ConfirmSheet';
import ProductCard from '@/components/ProductCard';
import ProgressPill from '@/components/ProgressPill';
import QuantityDisplay from '@/components/QuantityDisplay';
import { Screen } from '@/components/Screen';
import {
  Colors,
  Fonts,
  Radius,
  Spacing,
  TABLET_BREAKPOINT,
  Typography,
  getFamilyTint,
} from '@/constants/theme';
import { getLocationDisplay } from '@/constants/locations';
import { supabase } from '@/lib/supabase';
import { useProductEntries } from '@/hooks/useProductEntries';

type ChipState = 'idle' | 'saving' | 'saved';

function AutosaveChip({ state }: { state: ChipState }) {
  const saving = state === 'saving';
  return (
    <View style={[chipStyles.chip, { backgroundColor: saving ? Colors.borderLight : Colors.successLight }]}>
      <MaterialIcons
        name={saving ? 'cloud-upload' : 'cloud-done'}
        size={16}
        color={saving ? Colors.textSecondary : Colors.success}
      />
      <Text style={[chipStyles.label, { color: saving ? Colors.textSecondary : Colors.success }]}>
        {saving ? 'Guardando…' : state === 'saved' ? 'Guardado' : 'Guardado automático'}
      </Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  label: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    lineHeight: 16,
  },
});

export default function SobrantesScreen() {
  const { locationId } = useLocalSearchParams<{ locationId: string }>();
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;
  // Panel de detalle = ancho - rail (92) - lista (400); si queda estrecho, contadores en columna
  const stackCounters = isTablet && width - 492 < 640;

  const {
    sessionStatus,
    groups,
    entries,
    loading,
    saving,
    updateEntry,
    updateDiscarded,
    totalSobrantes,
    totalDescartado,
    filledCount,
    totalCount,
    closeDay,
  } = useProductEntries(locationId ?? '');

  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [locationName, setLocationName] = useState('');

  const isClosed = sessionStatus === 'closed';

  useEffect(() => {
    if (!locationId) return;
    supabase
      .from('locations')
      .select('name')
      .eq('id', locationId)
      .single()
      .then(({ data }) => {
        if (data) setLocationName(data.name);
      });
  }, [locationId]);

  const flatProducts = useMemo(() => groups.flatMap((g) => g.products), [groups]);

  const isFilled = (productId: string) => {
    const e = entries.get(productId);
    return !!e && (e.savedQty > 0 || e.discardedQty > 0);
  };

  // Acordeón de familias: todas colapsadas por defecto
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());

  const toggleFamily = (family: string) => {
    configureCollapseAnimation();
    setExpandedFamilies((prev) => {
      const next = new Set(prev);
      if (next.has(family)) {
        next.delete(family);
      } else {
        next.add(family);
      }
      return next;
    });
  };

  // La familia del producto seleccionado se auto-expande (tablet master-detail)
  useEffect(() => {
    if (!selectedProductId) return;
    const product = flatProducts.find((p) => p.id === selectedProductId);
    if (!product) return;
    setExpandedFamilies((prev) => {
      if (prev.has(product.family)) return prev;
      configureCollapseAnimation();
      const next = new Set(prev);
      next.add(product.family);
      return next;
    });
  }, [selectedProductId, flatProducts]);

  // Selección inicial en tablet: primer producto pendiente (o el primero)
  useEffect(() => {
    if (!isTablet || loading || selectedProductId || flatProducts.length === 0) return;
    const firstPending = flatProducts.find((p) => !isFilled(p.id));
    setSelectedProductId((firstPending ?? flatProducts[0]).id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTablet, loading, flatProducts]);

  // Chip de autoguardado: Guardando… → Guardado (1.5s) → Guardado automático
  const [chipState, setChipState] = useState<ChipState>('idle');
  const prevSaving = useRef(false);
  useEffect(() => {
    const was = prevSaving.current;
    prevSaving.current = saving;
    if (saving) {
      setChipState('saving');
      return;
    }
    if (was) {
      setChipState('saved');
      const t = setTimeout(() => setChipState('idle'), 1500);
      return () => clearTimeout(t);
    }
  }, [saving]);

  const selectedProduct = selectedProductId
    ? flatProducts.find((p) => p.id === selectedProductId) ?? null
    : null;
  const selectedEntry = selectedProductId ? entries.get(selectedProductId) : undefined;

  const goToPrev = () => {
    if (flatProducts.length === 0) return;
    const idx = flatProducts.findIndex((p) => p.id === selectedProductId);
    const prev = flatProducts[(idx - 1 + flatProducts.length) % flatProducts.length];
    setSelectedProductId(prev.id);
  };

  // "Siguiente producto" salta al siguiente pendiente; si no queda ninguno, al siguiente de la lista
  const goToNext = () => {
    const n = flatProducts.length;
    if (n === 0) return;
    const idx = flatProducts.findIndex((p) => p.id === selectedProductId);
    for (let step = 1; step <= n; step++) {
      const candidate = flatProducts[(idx + step) % n];
      if (!isFilled(candidate.id)) {
        setSelectedProductId(candidate.id);
        return;
      }
    }
    setSelectedProductId(flatProducts[(idx + 1) % n].id);
  };

  const handleClose = async () => {
    setShowConfirm(false);
    const { error } = await closeDay();
    if (error) {
      Alert.alert('Error', String(error));
    } else {
      Alert.alert(
        'Registro guardado',
        `${totalSobrantes} uds guardadas · ${totalDescartado} uds tiradas, en ${filledCount} productos`
      );
      router.back();
    }
  };

  const confirmSheet = (
    <ConfirmSheet
      visible={showConfirm}
      title="¿Cerrar el día?"
      message="Esto marcará el día como completo. Podrás ver el resumen después."
      summary={[
        { label: 'Productos registrados', value: `${filledCount} de ${totalCount}` },
        { label: 'Total guardado', value: `${totalSobrantes} uds`, color: Colors.primary },
        { label: 'Total tirado (merma)', value: `${totalDescartado} uds`, color: Colors.danger },
      ]}
      confirmLabel="Cerrar el día"
      onConfirm={handleClose}
      onCancel={() => setShowConfirm(false)}
    />
  );

  // Props del acordeón de familia (CollapsibleSection, compartido móvil / tablet)
  const familySectionProps = (group: (typeof groups)[number]) => {
    const registered = group.products.filter((p) => isFilled(p.id)).length;
    const total = group.products.length;
    return {
      title: group.family,
      family: group.family,
      meta: `registrados ${registered}/${total}`,
      metaDone: total > 0 && registered === total,
      expanded: expandedFamilies.has(group.family),
      onToggle: () => toggleFamily(group.family),
    };
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.loadingBox}>
          <MaterialIcons name="hourglass-empty" size={48} color={Colors.textMuted} />
          <Text style={styles.loadingText}>Cargando productos…</Text>
        </View>
      </Screen>
    );
  }

  // ---------- Móvil: lista que navega a product/[productId] ----------
  if (!isTablet) {
    return (
      <Screen scrollable>
        <View style={styles.progressHeader}>
          <ProgressPill current={filledCount} total={totalCount} />
          {!isClosed && (
            <Text style={styles.hint}>Toca una familia para ver y registrar sus productos</Text>
          )}
        </View>

        {groups.map((group) => (
          <CollapsibleSection key={group.family} {...familySectionProps(group)}>
            {group.products.map((product) => {
              const entry = entries.get(product.id);
              return (
                <ProductCard
                  key={product.id}
                  name={product.name}
                  family={product.family}
                  savedQty={entry?.savedQty}
                  discardedQty={entry?.discardedQty}
                  onPress={() =>
                    router.push(`/(tabs)/location/${locationId}/product/${product.id}`)
                  }
                />
              );
            })}
          </CollapsibleSection>
        ))}

        {!isClosed && totalCount > 0 && (
          <View style={styles.mobileFooter}>
            <Button
              title={`Cerrar el día (${filledCount}/${totalCount})`}
              variant="secondary"
              onPress={() => setShowConfirm(true)}
            />
          </View>
        )}

        {isClosed && (
          <View style={styles.closedNote}>
            <MaterialIcons name="check-circle" size={20} color={Colors.success} />
            <Text style={styles.closedNoteText}>Día registrado</Text>
          </View>
        )}

        {confirmSheet}
      </Screen>
    );
  }

  // ---------- Tablet: master-detail de dos paneles ----------
  const display = getLocationDisplay(locationName);

  return (
    <Screen noPadding>
      <View style={styles.tabletRoot}>
        {/* Panel izquierdo: lista de productos */}
        <View style={styles.leftPanel}>
          <View style={styles.leftHeader}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
              hitSlop={8}
            >
              <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
            </Pressable>
            <View style={styles.leftHeaderText}>
              <Text style={styles.leftTitle} numberOfLines={1}>
                {locationName ? `Sobrantes · ${display.shortName}` : 'Sobrantes'}
              </Text>
              <ProgressPill current={filledCount} total={totalCount} />
            </View>
          </View>

          <ScrollView
            style={styles.leftList}
            contentContainerStyle={styles.leftListContent}
            showsVerticalScrollIndicator={false}
          >
            {groups.map((group) => (
              <CollapsibleSection key={group.family} {...familySectionProps(group)}>
                {group.products.map((product) => {
                  const entry = entries.get(product.id);
                  return (
                    <ProductCard
                      key={product.id}
                      name={product.name}
                      family={product.family}
                      savedQty={entry?.savedQty}
                      discardedQty={entry?.discardedQty}
                      selected={product.id === selectedProductId}
                      onPress={() => setSelectedProductId(product.id)}
                    />
                  );
                })}
              </CollapsibleSection>
            ))}
          </ScrollView>

          <View style={styles.leftFooter}>
            {isClosed ? (
              <View style={styles.closedNote}>
                <MaterialIcons name="check-circle" size={20} color={Colors.success} />
                <Text style={styles.closedNoteText}>Día registrado</Text>
              </View>
            ) : (
              <Button
                title={`Cerrar el día (${filledCount}/${totalCount})`}
                variant="secondary"
                onPress={() => setShowConfirm(true)}
              />
            )}
          </View>
        </View>

        {/* Panel derecho: contador del producto seleccionado */}
        <View style={styles.rightPanel}>
          {selectedProduct ? (
            <ScrollView
              contentContainerStyle={styles.rightContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.rightHeader}>
                <View style={styles.rightHeaderInfo}>
                  <View
                    style={[styles.familyChip, { backgroundColor: getFamilyTint(selectedProduct.family) }]}
                  >
                    <Text style={styles.familyChipText}>{selectedProduct.family}</Text>
                  </View>
                  <Text style={styles.productName}>{selectedProduct.name}</Text>
                </View>
                <AutosaveChip state={chipState} />
              </View>

              <View style={[styles.countersRow, stackCounters && styles.countersColumn]}>
                <QuantityDisplay
                  label="Guardado"
                  hint="Se guarda para vender mañana"
                  icon="archive"
                  value={selectedEntry?.savedQty ?? 0}
                  onChange={(v) => updateEntry(selectedProduct.id, v)}
                  color={Colors.primary}
                  tint={Colors.primaryTint}
                  size="hero"
                  style={styles.counterCard}
                />
                <QuantityDisplay
                  label="Tirado / Merma"
                  hint="Se desecha (pérdida)"
                  icon="delete"
                  value={selectedEntry?.discardedQty ?? 0}
                  onChange={(v) => updateDiscarded(selectedProduct.id, v)}
                  color={Colors.danger}
                  tint={Colors.dangerLight}
                  size="hero"
                  style={styles.counterCard}
                />
              </View>

              <View style={styles.navRow}>
                <Button
                  title="Anterior"
                  variant="ghost"
                  onPress={goToPrev}
                  style={styles.navPrev}
                />
                <Button
                  title="Siguiente producto"
                  onPress={goToNext}
                  style={styles.navNext}
                />
              </View>
            </ScrollView>
          ) : (
            <View style={styles.emptyDetail}>
              <MaterialIcons name="touch-app" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyDetailText}>
                Selecciona un producto de la lista para registrar sus sobrantes
              </Text>
            </View>
          )}
        </View>
      </View>

      {confirmSheet}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xxxl,
  },
  loadingText: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
  },

  // Compartido (secciones y lista)
  progressHeader: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  hint: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
  mobileFooter: {
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  closedNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  closedNoteText: {
    ...Typography.labelMedium,
    color: Colors.success,
  },

  // Tablet master-detail
  tabletRoot: {
    flex: 1,
    flexDirection: 'row',
  },
  leftPanel: {
    width: 400,
    backgroundColor: Colors.bgCard,
    borderRightWidth: 1,
    borderRightColor: Colors.borderLight,
  },
  leftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
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
  leftHeaderText: {
    flex: 1,
    gap: Spacing.xs,
  },
  leftTitle: {
    fontFamily: Fonts.extraBold,
    fontSize: 18,
    lineHeight: 24,
    color: Colors.textPrimary,
  },
  leftList: {
    flex: 1,
  },
  leftListContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  leftFooter: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  rightPanel: {
    flex: 1,
  },
  rightContent: {
    padding: Spacing.xxl,
    gap: Spacing.xl,
  },
  rightHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.lg,
  },
  rightHeaderInfo: {
    flex: 1,
    gap: Spacing.sm,
    alignItems: 'flex-start',
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
    ...Typography.displayMedium,
    color: Colors.textPrimary,
  },
  countersRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  countersColumn: {
    flexDirection: 'column',
  },
  counterCard: {
    flex: 1,
  },
  navRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  navPrev: {
    flex: 1,
  },
  navNext: {
    flex: 2,
  },
  emptyDetail: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
    padding: Spacing.xxl,
  },
  emptyDetailText: {
    ...Typography.bodyLarge,
    color: Colors.textMuted,
    textAlign: 'center',
    maxWidth: 320,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
