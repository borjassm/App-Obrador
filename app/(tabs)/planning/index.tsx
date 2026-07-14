import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';

import Badge from '@/components/Badge';
import Button from '@/components/Button';
import Card from '@/components/Card';
import FilterPills from '@/components/FilterPills';
import Stepper from '@/components/Stepper';
import { Screen } from '@/components/Screen';
import { Colors, Fonts, Radius, Shadows, Spacing, Typography, getFamilyColor } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { analyticsService } from '@/services/analytics.service';
import { planningService, type AccuracyStats, type Suggestion } from '@/services/planning.service';

const WEEKDAY_LABELS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateWithOffset(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

interface PlanItem extends Suggestion {
  finalQty: number;       // sugerido u override del usuario
  overridden: boolean;
}

export default function PlanningTab() {
  const [offset, setOffset] = useState<'1' | '2' | '0'>('1'); // mañana por defecto
  const [items, setItems] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [accuracy, setAccuracy] = useState<AccuracyStats | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftQty, setDraftQty] = useState(0);

  const targetDate = useMemo(() => dateWithOffset(parseInt(offset, 10)), [offset]);
  const targetISO = iso(targetDate);
  const weekdayName = WEEKDAY_LABELS[targetDate.getDay()];

  const load = useCallback(async () => {
    setLoading(true);
    setSavedAt(null);
    setEditingId(null);
    try {
      // Cerrar el ciclo de mejora continua para planes pasados con ventas ya cargadas
      const latest = await analyticsService.latestDates();
      if (latest?.latest_sale) {
        const { data: pastPlans } = await supabase
          .from('production_plans')
          .select('plan_date')
          .lte('plan_date', latest.latest_sale)
          .order('plan_date', { ascending: false })
          .limit(60);
        const uniqueDates = [...new Set((pastPlans ?? []).map((p) => p.plan_date))].slice(0, 10);
        for (const d of uniqueDates) await planningService.recordAccuracy(d);
      }

      const [suggestions, saved, stats] = await Promise.all([
        planningService.suggestions(targetISO),
        planningService.savedPlan(targetISO),
        planningService.accuracyStats(90),
      ]);

      setItems(
        suggestions.map((s) => {
          const savedRow = saved.get(s.product_id);
          const overridden = savedRow?.override_qty != null;
          return {
            ...s,
            finalQty: overridden ? (savedRow!.override_qty as number) : s.suggested_qty,
            overridden,
          };
        })
      );
      setAccuracy(stats);
    } catch (e) {
      console.log('[PlanningTab] error:', e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [targetISO]);

  useEffect(() => {
    load();
  }, [load]);

  const totalUnits = items.reduce((s, i) => s + i.finalQty, 0);
  const editedCount = items.filter((i) => i.overridden).length;

  const groups = useMemo(() => {
    const map = new Map<string, PlanItem[]>();
    for (const item of items) {
      if (!map.has(item.family)) map.set(item.family, []);
      map.get(item.family)!.push(item);
    }
    return [...map.entries()];
  }, [items]);

  const openEdit = (item: PlanItem) => {
    if (editingId === item.product_id) {
      setEditingId(null);
      return;
    }
    setEditingId(item.product_id);
    setDraftQty(item.finalQty);
  };

  const applyEdit = () => {
    if (!editingId) return;
    setItems((prev) =>
      prev.map((i) =>
        i.product_id === editingId
          ? { ...i, finalQty: draftQty, overridden: draftQty !== i.suggested_qty }
          : i
      )
    );
    setEditingId(null);
  };

  const savePlan = async () => {
    setSaving(true);
    const { error } = await planningService.savePlan(
      targetISO,
      items.map((i) => ({
        product_id: i.product_id,
        suggested_qty: i.suggested_qty,
        override_qty: i.overridden ? i.finalQty : null,
        confidence: i.confidence,
      }))
    );
    setSaving(false);
    if (error) {
      Alert.alert('Error', 'No se pudo guardar el plan. Inténtalo de nuevo.');
    } else {
      setSavedAt(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
    }
  };

  const summaryLine =
    `${items.length} productos · ${totalUnits.toLocaleString('es-ES')} uds totales` +
    (editedCount > 0
      ? ` · ${editedCount} ${editedCount === 1 ? 'ajustado' : 'ajustados'} por ti`
      : '');

  return (
    <Screen noPadding>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.subtitle}>
            Sugerencias para el {weekdayName} {targetDate.getDate()}/{targetDate.getMonth() + 1}, según tu histórico de ventas
          </Text>
          <Text style={styles.title}>Planificación</Text>
        </View>

        <FilterPills
          options={[
            { key: '0', label: 'Hoy' },
            { key: '1', label: 'Mañana' },
            { key: '2', label: 'Pasado' },
          ]}
          selected={offset}
          onSelect={(k) => setOffset(k as '0' | '1' | '2')}
        />

        {/* Precisión del modelo */}
        <View style={styles.accuracyCard}>
          <View style={styles.accuracyIconTile}>
            <MaterialCommunityIcons name="target" size={24} color={Colors.secondaryLight} />
          </View>
          <View style={styles.accuracyInfo}>
            <Text style={styles.accuracyTitle}>
              {accuracy ? 'Precisión del modelo (90 días)' : 'Mejora continua activada'}
            </Text>
            <Text style={styles.accuracyDetail}>
              {accuracy
                ? `${accuracy.n} predicciones evaluadas · ${accuracy.hit_rate}% con error ≤ 20%. El modelo se ajusta solo con cada día de ventas.`
                : 'Cuando cargues ventas de días ya planificados, el modelo medirá su acierto y ajustará sus pesos por producto automáticamente.'}
            </Text>
          </View>
          {accuracy && (
            <Text style={styles.accuracyBig}>
              {Math.max(0, 100 - accuracy.mape).toFixed(0)}%
            </Text>
          )}
        </View>

        {loading ? (
          <View style={styles.stateBox}>
            <MaterialIcons name="hourglass-empty" size={48} color={Colors.textMuted} />
            <Text style={styles.stateText}>Calculando sugerencias…</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.stateBox}>
            <MaterialIcons name="event-note" size={48} color={Colors.textMuted} />
            <Text style={styles.stateText}>
              Sin histórico de ventas para sugerir. Importa ventas del ERP.
            </Text>
          </View>
        ) : (
          groups.map(([family, groupItems]) => (
            <View key={family} style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionDot, { backgroundColor: getFamilyColor(family) }]} />
                <Text style={styles.sectionLabel}>{family}</Text>
              </View>

              {groupItems.map((item) => {
                const isEditing = editingId === item.product_id;
                return (
                  <Card key={item.product_id} style={styles.rowCard} shadow="sm">
                    <View style={styles.row}>
                      <View style={styles.rowInfo}>
                        <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.rowExplain} numberOfLines={2}>
                          Media {weekdayName}: reciente {item.base_recent} · histórica {item.base_hist}
                          {item.carryover > 0 ? ` · guardado ayer ${item.carryover}` : ''}
                        </Text>
                      </View>
                      <Badge
                        label={item.confidence === 'high' ? 'Alta' : item.confidence === 'medium' ? 'Media' : 'Baja'}
                        variant={item.confidence === 'high' ? 'success' : item.confidence === 'medium' ? 'warning' : 'neutral'}
                      />
                      <View style={styles.qtyBox}>
                        <Text style={[styles.qtyNum, item.overridden && styles.qtyNumAdjusted]}>
                          {item.finalQty}
                        </Text>
                        <Text style={[styles.qtyLabel, item.overridden && styles.qtyLabelAdjusted]}>
                          {item.overridden ? 'ajustado' : 'sugerido'}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => openEdit(item)}
                        style={({ pressed }) => [
                          styles.editBtn,
                          isEditing && styles.editBtnActive,
                          pressed && styles.pressed,
                        ]}
                      >
                        <MaterialIcons
                          name={isEditing ? 'close' : 'edit'}
                          size={22}
                          color={isEditing ? Colors.textOnPrimary : Colors.primary}
                        />
                      </Pressable>
                    </View>

                    {/* Edición inline */}
                    {isEditing && (
                      <View style={styles.editArea}>
                        <Text style={styles.editHint}>
                          Sugerido por el modelo: {item.suggested_qty} uds
                        </Text>
                        <Stepper value={draftQty} onChange={setDraftQty} min={0} color={Colors.secondary} />
                        <View style={styles.editActions}>
                          <Button title="Cancelar" variant="ghost" onPress={() => setEditingId(null)} style={styles.editActionBtn} />
                          <Button title="Aplicar" onPress={applyEdit} style={styles.editActionBtn} />
                        </View>
                      </View>
                    )}
                  </Card>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>

      {/* Footer fijo */}
      {!loading && items.length > 0 && (
        <View style={styles.footer}>
          <View style={styles.footerInfo}>
            <Text style={styles.totalLine} numberOfLines={2}>{summaryLine}</Text>
            {savedAt && (
              <View style={styles.savedChip}>
                <MaterialIcons name="cloud-done" size={14} color={Colors.success} />
                <Text style={styles.savedChipText}>Plan guardado a las {savedAt}</Text>
              </View>
            )}
          </View>
          <Pressable
            onPress={savePlan}
            disabled={saving}
            style={({ pressed }) => [
              styles.saveCta,
              pressed && styles.pressed,
              saving && styles.disabled,
            ]}
          >
            <MaterialIcons name="save" size={20} color={Colors.textOnPrimary} />
            <Text style={styles.saveCtaText}>
              {saving ? 'Guardando…' : 'Guardar plan de producción'}
            </Text>
          </Pressable>
        </View>
      )}
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
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.sm,
    gap: 2,
  },
  subtitle: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
  },
  title: {
    ...Typography.displayMedium,
    color: Colors.textPrimary,
  },
  // Card oscura de precisión
  accuracyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    backgroundColor: Colors.bgDark,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.md,
    ...Shadows.md,
  },
  accuracyIconTile: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(123, 196, 168, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accuracyInfo: {
    flex: 1,
    gap: 3,
  },
  accuracyTitle: {
    fontFamily: Fonts.extraBold,
    fontSize: 15,
    lineHeight: 20,
    color: Colors.textOnDark,
  },
  accuracyDetail: {
    fontFamily: Fonts.medium,
    fontSize: 12.5,
    lineHeight: 17,
    color: 'rgba(246, 241, 233, 0.6)',
  },
  accuracyBig: {
    fontFamily: Fonts.extraBold,
    fontSize: 34,
    lineHeight: 40,
    color: Colors.secondaryLight,
    fontVariant: ['tabular-nums'],
  },
  // Estados de carga / vacío
  stateBox: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xxxl,
    paddingHorizontal: Spacing.xl,
  },
  stateText: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  // Secciones por familia
  section: {
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  sectionDot: {
    width: 10,
    height: 10,
    borderRadius: Radius.full,
  },
  sectionLabel: {
    ...Typography.sectionLabel,
  },
  // Filas como cards
  rowCard: {
    padding: Spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    fontFamily: Fonts.extraBold,
    fontSize: 15.5,
    lineHeight: 21,
    color: Colors.textPrimary,
  },
  rowExplain: {
    fontFamily: Fonts.semiBold,
    fontSize: 12.5,
    lineHeight: 17,
    color: Colors.textMuted,
  },
  qtyBox: {
    alignItems: 'center',
    minWidth: 72,
  },
  qtyNum: {
    ...Typography.numberMedium,
    color: Colors.textPrimary,
  },
  qtyNumAdjusted: {
    color: Colors.secondary,
  },
  qtyLabel: {
    ...Typography.meta,
    fontSize: 11,
    lineHeight: 14,
  },
  qtyLabelAdjusted: {
    color: Colors.secondary,
  },
  editBtn: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtnActive: {
    backgroundColor: Colors.primary,
  },
  // Edición inline
  editArea: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    alignItems: 'center',
    gap: Spacing.lg,
  },
  editHint: {
    ...Typography.meta,
  },
  editActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  editActionBtn: {
    flex: 1,
    maxWidth: 220,
  },
  // Footer fijo
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  footerInfo: {
    flex: 1,
    minWidth: 220,
    gap: 3,
  },
  totalLine: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
  },
  savedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  savedChipText: {
    ...Typography.meta,
    color: Colors.success,
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
