import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import Badge from '@/components/Badge';
import Button from '@/components/Button';
import Card from '@/components/Card';
import FilterPills from '@/components/FilterPills';
import SectionHeader from '@/components/SectionHeader';
import Stepper from '@/components/Stepper';
import { Screen } from '@/components/Screen';
import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
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
  const [editing, setEditing] = useState<PlanItem | null>(null);
  const [draftQty, setDraftQty] = useState(0);

  const targetDate = useMemo(() => dateWithOffset(parseInt(offset, 10)), [offset]);
  const targetISO = iso(targetDate);
  const weekdayName = WEEKDAY_LABELS[targetDate.getDay()];

  const load = useCallback(async () => {
    setLoading(true);
    setSavedAt(null);
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
    setEditing(item);
    setDraftQty(item.finalQty);
  };

  const applyEdit = () => {
    if (!editing) return;
    setItems((prev) =>
      prev.map((i) =>
        i.product_id === editing.product_id
          ? { ...i, finalQty: draftQty, overridden: draftQty !== i.suggested_qty }
          : i
      )
    );
    setEditing(null);
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

  return (
    <Screen scrollable noPadding>
      <View style={styles.header}>
        <Text style={styles.title}>📋 Planificación</Text>
        <Text style={styles.subtitle}>
          Sugerencias para el {weekdayName} {targetDate.getDate()}/{targetDate.getMonth() + 1}, según tu histórico de ventas
        </Text>
      </View>

      <FilterPills
        options={[
          { key: '0', label: 'Hoy' },
          { key: '1', label: 'Mañana' },
          { key: '2', label: 'Pasado mañana' },
        ]}
        selected={offset}
        onSelect={(k) => setOffset(k as '0' | '1' | '2')}
      />

      {/* Precisión del modelo */}
      <Card style={styles.accuracyCard} shadow="sm">
        {accuracy ? (
          <>
            <Text style={styles.accuracyTitle}>🎯 Precisión del modelo (90 días)</Text>
            <Text style={styles.accuracyBig}>{Math.max(0, 100 - accuracy.mape).toFixed(0)}%</Text>
            <Text style={styles.accuracyDetail}>
              {accuracy.n} predicciones evaluadas · {accuracy.hit_rate}% con error ≤ 20%. El modelo se ajusta solo con cada día de ventas.
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.accuracyTitle}>🎯 Mejora continua activada</Text>
            <Text style={styles.accuracyDetail}>
              Cuando cargues ventas de días ya planificados, el modelo medirá su acierto y ajustará sus pesos por producto automáticamente.
            </Text>
          </>
        )}
      </Card>

      {loading ? (
        <View style={styles.loadingBox}>
          <Text style={styles.loadingText}>Calculando sugerencias…</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.loadingBox}>
          <Text style={styles.loadingText}>Sin histórico de ventas para sugerir. Importa ventas del ERP.</Text>
        </View>
      ) : (
        <>
          {groups.map(([family, groupItems]) => (
            <View key={family} style={styles.section}>
              <View style={styles.sectionPad}>
                <SectionHeader
                  title={family.charAt(0).toUpperCase() + family.slice(1)}
                  family={family}
                />
              </View>
              {groupItems.map((item) => (
                <Pressable key={item.product_id} onPress={() => openEdit(item)} style={styles.row}>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.rowExplain}>
                      Media {weekdayName}: reciente {item.base_recent} · histórica {item.base_hist}
                      {item.carryover > 0 ? ` · guardado ayer ${item.carryover}` : ''}
                    </Text>
                  </View>
                  <Badge
                    label={item.confidence === 'high' ? 'Alta' : item.confidence === 'medium' ? 'Media' : 'Baja'}
                    variant={item.confidence === 'high' ? 'success' : item.confidence === 'medium' ? 'warning' : 'neutral'}
                  />
                  <View style={styles.qtyBox}>
                    <Text style={[styles.qtyNum, item.overridden && { color: Colors.secondary }]}>
                      {item.finalQty}
                    </Text>
                    <Text style={styles.qtyLabel}>{item.overridden ? 'ajustado' : 'sugerido'}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ))}

          {/* Guardar */}
          <View style={styles.footer}>
            <Text style={styles.totalLine}>
              {items.length} productos · {totalUnits.toLocaleString('es-ES')} uds totales
              {editedCount > 0 ? ` · ${editedCount} ajustados por ti` : ''}
            </Text>
            <Button
              title={saving ? 'Guardando…' : savedAt ? `Plan guardado (${savedAt}) — Guardar de nuevo` : 'Guardar plan de producción'}
              onPress={savePlan}
              disabled={saving}
            />
          </View>
        </>
      )}

      {/* Modal de ajuste */}
      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <Pressable style={styles.backdrop} onPress={() => setEditing(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Ajustar cantidad</Text>
            <Text style={styles.sheetName}>{editing?.name}</Text>
            <Text style={styles.sheetHint}>
              Sugerido por el modelo: {editing?.suggested_qty} uds
            </Text>
            <View style={styles.sheetDisplay}>
              <Text style={styles.sheetNumber}>{draftQty}</Text>
              <Text style={styles.sheetUnit}>uds</Text>
            </View>
            <Stepper value={draftQty} onChange={setDraftQty} min={0} color={Colors.secondary} />
            <View style={styles.sheetActions}>
              <Button title="Cancelar" variant="ghost" onPress={() => setEditing(null)} />
              <Button title="Aplicar" onPress={applyEdit} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <View style={styles.bottomPad} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: Spacing.lg,
    paddingTop: Spacing.xxl,
    gap: Spacing.xs,
  },
  title: {
    ...Typography.displayMedium,
    color: Colors.textPrimary,
  },
  subtitle: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  accuracyCard: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  accuracyTitle: {
    ...Typography.labelMedium,
    color: Colors.textPrimary,
  },
  accuracyBig: {
    ...Typography.numberMedium,
    color: Colors.success,
  },
  accuracyDetail: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
  loadingBox: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
  },
  loadingText: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
  section: {
    marginTop: Spacing.xl,
  },
  sectionPad: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: 1,
    gap: Spacing.md,
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    ...Typography.labelMedium,
    color: Colors.textPrimary,
  },
  rowExplain: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    fontSize: 11,
  },
  qtyBox: {
    alignItems: 'center',
    minWidth: 64,
  },
  qtyNum: {
    ...Typography.numberSmall,
    color: Colors.primary,
  },
  qtyLabel: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    fontSize: 10,
  },
  footer: {
    padding: Spacing.lg,
    paddingTop: Spacing.xl,
    gap: Spacing.md,
  },
  totalLine: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  backdrop: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xl,
    gap: Spacing.lg,
    alignItems: 'center',
    ...Shadows.lg,
  },
  sheetTitle: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
  },
  sheetName: {
    ...Typography.headingMedium,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  sheetHint: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
  sheetDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  sheetNumber: {
    fontSize: 56,
    fontWeight: '700',
    color: Colors.secondary,
  },
  sheetUnit: {
    ...Typography.bodyLarge,
    color: Colors.textMuted,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignSelf: 'stretch',
    justifyContent: 'space-between',
  },
  bottomPad: {
    height: Spacing.xxxl,
  },
});
