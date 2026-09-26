import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
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
import InlineCounter from '@/components/InlineCounter';
import ProgressPill from '@/components/ProgressPill';
import { Screen } from '@/components/Screen';
import SectionHeader from '@/components/SectionHeader';
import { LEFTOVERS_SECTIONS } from '@/constants/families';
import { getLocationDisplay } from '@/constants/locations';
import { Colors, Fonts, Radius, Shadows, Spacing, TABLET_BREAKPOINT, Typography } from '@/constants/theme';
import { useProductEntries, type ProductEntry } from '@/hooks/useProductEntries';
import { supabase } from '@/lib/supabase';
import type { Product } from '@/services/product.service';

// Confirmación que funciona también en web (Alert.alert con botones no se
// muestra en react-native-web)
function confirmAsync(title: string, message: string, confirmLabel: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

export default function SobrantesScreen() {
  const { locationId } = useLocalSearchParams<{ locationId: string }>();
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;
  // En móvil estrecho los contadores van debajo del nombre
  const stackRow = width < 560;

  const {
    sessionStatus,
    dayISO,
    groups,
    entries,
    loading,
    saving,
    dirtyCount,
    updateEntry,
    updateDiscarded,
    updateComment,
    saveAll,
    totalSobrantes,
    totalDescartado,
    filledCount,
    totalCount,
    closeDay,
    reopenDay,
    refresh,
    addCustomProduct,
  } = useProductEntries(locationId ?? '');

  const [locationName, setLocationName] = useState('');
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());
  const [openComments, setOpenComments] = useState<Set<string>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Alta manual de producto puntual
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductFamily, setNewProductFamily] = useState<string>(LEFTOVERS_SECTIONS[0]);
  const [addingProduct, setAddingProduct] = useState(false);

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

  // Al volver a la pantalla, recargar lo guardado (conserva cambios locales)
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const display = getLocationDisplay(locationName);
  const dateLabel = new Date(dayISO + 'T12:00:00').toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

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

  const toggleComment = (productId: string) => {
    setOpenComments((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    const { error } = await saveAll();
    if (error) {
      Alert.alert('Error al guardar', error);
      return;
    }
    setSavedAt(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
  };

  const handleBack = async () => {
    if (dirtyCount > 0) {
      const leave = await confirmAsync(
        'Cambios sin guardar',
        `Tienes ${dirtyCount} ${dirtyCount === 1 ? 'producto' : 'productos'} sin guardar. Si sales ahora se perderán.`,
        'Salir sin guardar'
      );
      if (!leave) return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleClose = async () => {
    setShowConfirm(false);
    const { error } = await closeDay();
    if (error) {
      Alert.alert('Error', String(error.message ?? error));
    }
  };

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

  const topBar = (
    <View style={styles.topBar}>
      <Pressable
        onPress={handleBack}
        style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
        hitSlop={8}
        accessibilityLabel="Volver"
      >
        <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
      </Pressable>
      <View style={styles.topText}>
        <Text style={styles.topTitle} numberOfLines={1}>
          Sobrantes{locationName ? ` · ${display.shortName}` : ''}
        </Text>
        <Text style={styles.topSubtitle}>{dateLabel}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <Screen>
        {topBar}
        <View style={styles.stateBox}>
          <MaterialIcons name="hourglass-empty" size={48} color={Colors.textMuted} />
          <Text style={styles.stateText}>Cargando productos…</Text>
        </View>
      </Screen>
    );
  }

  // ---------- Día cerrado: resumen (solo lo registrado) ----------
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
        {topBar}
        <View style={styles.summaryHero}>
          <MaterialIcons name="check-circle" size={44} color={Colors.success} />
          <Text style={styles.summaryTitle}>Día registrado</Text>
          <Text style={styles.summaryMeta}>
            {filledCount} productos · {totalSobrantes} uds guardadas · {totalDescartado} uds tiradas
          </Text>
        </View>

        {summaryGroups.length === 0 ? (
          <Text style={styles.stateText}>No se registró ningún sobrante hoy.</Text>
        ) : (
          summaryGroups.map((group) => (
            <View key={group.family}>
              <SectionHeader title={group.family} family={group.family} count={group.rows.length} />
              <View style={styles.list}>
                {group.rows.map(({ product, entry }) => (
                  <View key={product.id} style={styles.summaryRow}>
                    <View style={styles.summaryInfo}>
                      <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
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

  // ---------- Registro: lista rápida con − / + en cada fila ----------
  const renderProduct = (product: Product, entry: ProductEntry | undefined) => {
    const saved = entry?.savedQty ?? 0;
    const discarded = entry?.discardedQty ?? 0;
    const comment = entry?.comment ?? '';
    const hasComment = comment.trim().length > 0;
    const showComment = openComments.has(product.id);
    const dirty = entry?.dirty ?? false;

    const nameBlock = (
      <View style={styles.nameBlock}>
        {dirty && <View style={styles.dirtyDot} />}
        <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
        <Pressable
          onPress={() => toggleComment(product.id)}
          hitSlop={8}
          style={({ pressed }) => [styles.commentBtn, pressed && styles.pressed]}
          accessibilityLabel={`Comentario de ${product.name}`}
        >
          <MaterialIcons
            name={hasComment ? 'chat-bubble' : 'chat-bubble-outline'}
            size={19}
            color={hasComment ? Colors.secondary : Colors.textMuted}
          />
        </Pressable>
      </View>
    );

    const counters = (
      <View style={styles.counters}>
        <InlineCounter
          label="Guardado"
          value={saved}
          onChange={(v) => updateEntry(product.id, v)}
          color={Colors.primary}
        />
        <InlineCounter
          label="Tirado"
          value={discarded}
          onChange={(v) => updateDiscarded(product.id, v)}
          color={Colors.danger}
        />
      </View>
    );

    return (
      <View key={product.id} style={styles.productRow}>
        <View style={stackRow ? styles.rowStacked : styles.rowInline}>
          {nameBlock}
          {counters}
        </View>
        {showComment && (
          <TextInput
            value={comment}
            onChangeText={(t) => updateComment(product.id, t)}
            placeholder="Comentario: por qué se ha tirado, incidencias…"
            placeholderTextColor={Colors.textMuted}
            style={styles.commentInput}
            multiline
          />
        )}
      </View>
    );
  };

  return (
    <Screen noPadding>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, isTablet && styles.padTablet]}
        keyboardShouldPersistTaps="handled"
      >
        {topBar}

        <View style={styles.progressHeader}>
          <ProgressPill current={filledCount} total={totalCount} />
          <Pressable
            onPress={() => setShowAddProduct(true)}
            style={({ pressed }) => [styles.addProductBtn, pressed && styles.pressed]}
          >
            <MaterialIcons name="add" size={18} color={Colors.primary} />
            <Text style={styles.addProductText}>Añadir producto puntual</Text>
          </Pressable>
        </View>

        {groups.map((group) => {
          const registered = group.products.filter((p) => {
            const e = entries.get(p.id);
            return !!e && (e.savedQty > 0 || e.discardedQty > 0);
          }).length;
          return (
            <CollapsibleSection
              key={group.family}
              title={group.family}
              family={group.family}
              meta={`${registered}/${group.products.length}`}
              metaDone={group.products.length > 0 && registered === group.products.length}
              expanded={expandedFamilies.has(group.family)}
              onToggle={() => toggleFamily(group.family)}
            >
              {group.products.map((product) => renderProduct(product, entries.get(product.id)))}
            </CollapsibleSection>
          );
        })}
      </ScrollView>

      {/* Footer fijo: guardar + cerrar el día */}
      <View style={[styles.footer, isTablet && styles.footerTablet]}>
        <Text style={[styles.footerStatus, dirtyCount > 0 && styles.footerStatusDirty]} numberOfLines={1}>
          {dirtyCount > 0
            ? `${dirtyCount} ${dirtyCount === 1 ? 'cambio' : 'cambios'} sin guardar`
            : savedAt
              ? `Todo guardado · ${savedAt}`
              : 'Todo guardado'}
        </Text>
        <View style={styles.footerButtons}>
          <Pressable
            onPress={handleSave}
            disabled={dirtyCount === 0 || saving}
            style={({ pressed }) => [
              styles.saveBtn,
              (dirtyCount === 0 || saving) && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <MaterialIcons name="save" size={20} color={Colors.textOnPrimary} />
            <Text style={styles.saveBtnText}>{saving ? 'Guardando…' : 'Guardar'}</Text>
          </Pressable>
          <Pressable
            onPress={() => setShowConfirm(true)}
            disabled={saving}
            style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
          >
            <MaterialIcons name="check-circle" size={20} color={Colors.secondary} />
            <Text style={styles.closeBtnText}>Cerrar el día</Text>
          </Pressable>
        </View>
      </View>

      <ConfirmSheet
        visible={showConfirm}
        title="¿Cerrar el día?"
        message="Se guardarán los cambios pendientes y el día quedará registrado."
        summary={[
          { label: 'Productos registrados', value: `${filledCount} de ${totalCount}` },
          { label: 'Total guardado', value: `${totalSobrantes} uds`, color: Colors.primary },
          { label: 'Total tirado', value: `${totalDescartado} uds`, color: Colors.danger },
        ]}
        confirmLabel="Cerrar el día"
        onConfirm={handleClose}
        onCancel={() => setShowConfirm(false)}
      />

      <Modal
        visible={showAddProduct}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddProduct(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Añadir producto puntual</Text>
            <Text style={styles.modalHint}>
              Para cosas hechas hoy que no están en la lista.
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
              {LEFTOVERS_SECTIONS.map((family) => (
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: Spacing.xxl,
  },
  padTablet: {
    paddingHorizontal: 44,
  },

  // Cabecera
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
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
  topText: {
    flex: 1,
    gap: 2,
  },
  topTitle: {
    ...Typography.headingLarge,
    color: Colors.textPrimary,
  },
  topSubtitle: {
    ...Typography.meta,
    textTransform: 'capitalize',
  },
  stateBox: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xxxl,
  },
  stateText: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  progressHeader: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
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

  // Filas de producto: finas, sin barra de familia, contadores en línea
  productRow: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  rowInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  rowStacked: {
    gap: Spacing.xs,
  },
  nameBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 32,
  },
  dirtyDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.warning,
  },
  productName: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    lineHeight: 20,
    color: Colors.textPrimary,
    flex: 1,
  },
  commentBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counters: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.lg,
  },
  commentInput: {
    marginTop: Spacing.sm,
    minHeight: 44,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.bgBase,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    textAlignVertical: 'top',
  },

  // Footer fijo
  footer: {
    gap: Spacing.sm,
    backgroundColor: Colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingHorizontal: 20,
    paddingVertical: Spacing.md,
  },
  footerTablet: {
    paddingHorizontal: 44,
  },
  footerStatus: {
    ...Typography.meta,
    textAlign: 'center',
  },
  footerStatusDirty: {
    color: Colors.warning,
    fontFamily: Fonts.bold,
  },
  footerButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    ...Shadows.cta,
  },
  saveBtnText: {
    ...Typography.labelLarge,
    color: Colors.textOnPrimary,
  },
  closeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 56,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  closeBtnText: {
    ...Typography.labelLarge,
    color: Colors.secondary,
  },

  // Resumen del día cerrado
  list: {
    gap: Spacing.sm,
  },
  summaryHero: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xl,
  },
  summaryTitle: {
    ...Typography.displayMedium,
    color: Colors.textPrimary,
  },
  summaryMeta: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    minHeight: 52,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  summaryInfo: {
    flex: 1,
    gap: 2,
  },
  summaryComment: {
    ...Typography.meta,
    fontStyle: 'italic',
  },
  summaryQtyBox: {
    alignItems: 'center',
    minWidth: 60,
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

  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.4,
  },
});
