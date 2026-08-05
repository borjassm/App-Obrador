import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

import Button from '@/components/Button';
import CollapsibleSection, { configureCollapseAnimation } from '@/components/CollapsibleSection';
import ConfirmSheet from '@/components/ConfirmSheet';
import ProductCard from '@/components/ProductCard';
import ProgressPill from '@/components/ProgressPill';
import QuantityDisplay from '@/components/QuantityDisplay';
import { Screen } from '@/components/Screen';
import SectionHeader from '@/components/SectionHeader';
import {
  Colors,
  Fonts,
  Radius,
  Shadows,
  Spacing,
  TABLET_BREAKPOINT,
  Typography,
  getFamilyTint,
} from '@/constants/theme';
import { FAMILY_ORDER } from '@/constants/families';
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
    updateComment,
    saveEntry,
    totalSobrantes,
    totalDescartado,
    filledCount,
    totalCount,
    closeDay,
    reopenDay,
    refresh,
    addCustomProduct,
  } = useProductEntries(locationId ?? '');

  // Al volver a esta pantalla, recargar: la ficha de producto (móvil) guarda
  // en BD y la lista se quedaba desactualizada ("Pendiente" perpetuo)
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // Alta manual de producto puntual
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductFamily, setNewProductFamily] = useState<string>('panaderia');
  const [addingProduct, setAddingProduct] = useState(false);

  const handleAddProduct = async () => {
    if (!newProductName.trim() || addingProduct) return;
    setAddingProduct(true);
    const { error } = await addCustomProduct(newProductName, newProductFamily);
    setAddingProduct(false);
    if (error) {
      Alert.alert('No se pudo crear', error);
      return;
    }
    setShowAddProduct(false);
    setNewProductName('');
    setExpandedFamilies((prev) => new Set(prev).add(newProductFamily));
  };

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

  // ---------- Día cerrado: resumen real (solo lo registrado) ----------
  if (isClosed) {
    const summaryGroups = groups
      .map((group) => ({
        family: group.family,
        rows: group.products
          .map((p) => ({ product: p, entry: entries.get(p.id) }))
          .filter(({ entry }) => entry && (entry.savedQty > 0 || entry.discardedQty > 0)),
      }))
      .filter((g) => g.rows.length > 0);

    return (
      <Screen scrollable>
        <View style={styles.summaryHero}>
          <MaterialIcons name="check-circle" size={44} color={Colors.success} />
          <Text style={styles.summaryTitle}>Día registrado</Text>
          <Text style={styles.summaryMeta}>
            {filledCount} productos · {totalSobrantes} uds guardadas · {totalDescartado} uds tiradas
          </Text>
        </View>

        {summaryGroups.length === 0 ? (
          <Text style={styles.summaryEmpty}>No se registró ningún sobrante hoy.</Text>
        ) : (
          summaryGroups.map((group) => (
            <View key={group.family}>
              <SectionHeader title={group.family} family={group.family} count={group.rows.length} />
              <View style={styles.summaryList}>
                {group.rows.map(({ product, entry }) => (
                  <View key={product.id} style={styles.summaryRow}>
                    <View style={styles.summaryInfo}>
                      <Text style={styles.summaryName} numberOfLines={1}>{product.name}</Text>
                      {!!entry!.comment && (
                        <Text style={styles.summaryComment} numberOfLines={2}>
                          {entry!.comment}
                        </Text>
                      )}
                    </View>
                    <View style={styles.summaryQtyBox}>
                      <Text style={styles.summarySaved}>{entry!.savedQty}</Text>
                      <Text style={styles.summaryQtyLabel}>guardado</Text>
                    </View>
                    <View style={styles.summaryQtyBox}>
                      <Text style={styles.summaryDiscarded}>{entry!.discardedQty}</Text>
                      <Text style={styles.summaryQtyLabel}>tirado</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))
        )}

        <View style={styles.summaryFooter}>
          <Button
            title="Modificar registro"
            variant="ghost"
            onPress={async () => {
              const { error } = await reopenDay();
              if (error) Alert.alert('Error', 'No se pudo reabrir el día.');
            }}
          />
        </View>
      </Screen>
    );
  }

  // Modal de alta manual de producto puntual (compartido móvil / tablet)
  const addProductModal = (
    <Modal visible={showAddProduct} transparent animationType="fade" onRequestClose={() => setShowAddProduct(false)}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Añadir producto puntual</Text>
          <Text style={styles.modalHint}>
            Para cosas hechas hoy que no están en la lista. Quedará disponible también en producción
            y plan.
          </Text>
          <TextInput
            value={newProductName}
            onChangeText={setNewProductName}
            placeholder="Nombre del producto"
            placeholderTextColor={Colors.textMuted}
            style={styles.modalInput}
            autoFocus
          />
          <View style={styles.modalFamilies}>
            {FAMILY_ORDER.filter((f) => f !== 'otros').map((family) => (
              <Pressable
                key={family}
                onPress={() => setNewProductFamily(family)}
                style={({ pressed }) => [
                  styles.modalFamilyPill,
                  newProductFamily === family && styles.modalFamilyPillActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.modalFamilyText,
                    newProductFamily === family && styles.modalFamilyTextActive,
                  ]}
                >
                  {family}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.modalActions}>
            <Button
              title="Cancelar"
              variant="ghost"
              onPress={() => setShowAddProduct(false)}
              style={styles.modalActionBtn}
            />
            <Button
              title={addingProduct ? 'Creando…' : 'Crear'}
              onPress={handleAddProduct}
              disabled={!newProductName.trim() || addingProduct}
              style={styles.modalActionBtn}
            />
          </View>
        </View>
      </View>
    </Modal>
  );

  // ---------- Móvil: lista que navega a product/[productId] ----------
  if (!isTablet) {
    return (
      <Screen scrollable>
        <View style={styles.progressHeader}>
          <ProgressPill current={filledCount} total={totalCount} />
          <Text style={styles.hint}>Toca una familia para ver y registrar sus productos</Text>
          <Pressable
            onPress={() => setShowAddProduct(true)}
            style={({ pressed }) => [styles.addProductBtn, pressed && styles.pressed]}
          >
            <MaterialIcons name="add" size={18} color={Colors.primary} />
            <Text style={styles.addProductText}>Añadir producto puntual</Text>
          </Pressable>
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

        {totalCount > 0 && (
          <View style={styles.mobileFooter}>
            <Button
              title={`Cerrar el día (${filledCount}/${totalCount})`}
              variant="secondary"
              onPress={() => setShowConfirm(true)}
            />
          </View>
        )}

        {confirmSheet}
        {addProductModal}
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
            <Pressable
              onPress={() => setShowAddProduct(true)}
              style={({ pressed }) => [styles.addProductBtn, pressed && styles.pressed]}
            >
              <MaterialIcons name="add" size={18} color={Colors.primary} />
              <Text style={styles.addProductText}>Añadir producto puntual</Text>
            </Pressable>
            <Button
              title={`Cerrar el día (${filledCount}/${totalCount})`}
              variant="secondary"
              onPress={() => setShowConfirm(true)}
            />
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
                  label="Tirado"
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

              {/* Comentario del producto (por qué se tira, incidencias…) */}
              <View style={styles.commentCard}>
                <Text style={styles.commentLabel}>Comentario</Text>
                <TextInput
                  value={selectedEntry?.comment ?? ''}
                  onChangeText={(t) => updateComment(selectedProduct.id, t)}
                  placeholder="Opcional: por qué se ha tirado, incidencias del día…"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.commentInput}
                  multiline
                />
              </View>

              <Button
                title={selectedEntry?.dirty ? 'Guardar producto' : 'Guardado'}
                variant={selectedEntry?.dirty ? 'primary' : 'ghost'}
                disabled={!selectedEntry?.dirty}
                onPress={() => saveEntry(selectedProduct.id)}
              />

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
      {addProductModal}
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

  // Añadir producto puntual
  addProductBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    minHeight: 44,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    paddingHorizontal: Spacing.lg,
  },
  addProductText: {
    ...Typography.labelMedium,
    color: Colors.primary,
  },

  // Modal de alta
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: Colors.bgBase,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    gap: Spacing.md,
    ...Shadows.lg,
  },
  modalTitle: {
    ...Typography.headingLarge,
    color: Colors.textPrimary,
  },
  modalHint: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
  modalInput: {
    minHeight: 52,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    paddingHorizontal: Spacing.lg,
    ...Typography.bodyLarge,
    color: Colors.textPrimary,
  },
  modalFamilies: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  modalFamilyPill: {
    minHeight: 38,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalFamilyPillActive: {
    backgroundColor: Colors.primaryTint,
    borderColor: Colors.primary,
  },
  modalFamilyText: {
    ...Typography.labelMedium,
    fontSize: 13,
    color: Colors.textSecondary,
    textTransform: 'capitalize',
  },
  modalFamilyTextActive: {
    color: Colors.primary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  modalActionBtn: {
    flex: 1,
  },

  // Comentario (panel tablet)
  commentCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  commentLabel: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
  },
  commentInput: {
    minHeight: 64,
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    textAlignVertical: 'top',
  },

  // Resumen del día cerrado
  summaryHero: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xxl,
  },
  summaryTitle: {
    ...Typography.displayMedium,
    color: Colors.textPrimary,
  },
  summaryMeta: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  summaryEmpty: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: Spacing.xxl,
  },
  summaryList: {
    gap: Spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    minHeight: 56,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  summaryInfo: {
    flex: 1,
    gap: 2,
  },
  summaryName: {
    ...Typography.bodyLarge,
    color: Colors.textPrimary,
  },
  summaryComment: {
    ...Typography.meta,
    fontStyle: 'italic',
  },
  summaryQtyBox: {
    alignItems: 'center',
    minWidth: 64,
  },
  summarySaved: {
    ...Typography.numberSmall,
    color: Colors.primary,
  },
  summaryDiscarded: {
    ...Typography.numberSmall,
    color: Colors.danger,
  },
  summaryQtyLabel: {
    ...Typography.meta,
    fontSize: 11,
  },
  summaryFooter: {
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
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
