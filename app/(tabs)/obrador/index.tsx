import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import Button from '@/components/Button';
import FilterPills from '@/components/FilterPills';
import SectionHeader from '@/components/SectionHeader';
import Stepper from '@/components/Stepper';
import { Screen } from '@/components/Screen';
import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { productionService, type ProductionStatus } from '@/services/production.service';

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function ProductionTab() {
  const [dayOffset, setDayOffset] = useState<'0' | '-1'>('0');
  const [rows, setRows] = useState<ProductionStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ProductionStatus | null>(null);
  const [draftQty, setDraftQty] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showOnlyPlanned, setShowOnlyPlanned] = useState(true);

  const targetDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + parseInt(dayOffset, 10));
    return d;
  }, [dayOffset]);
  const targetISO = iso(targetDate);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await productionService.statusFor(targetISO));
    } catch (e) {
      console.log('[ProductionTab] error:', e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [targetISO]);

  useEffect(() => {
    load();
  }, [load]);

  const hasPlan = rows.some((r) => r.planned != null);
  const visible = showOnlyPlanned && hasPlan
    ? rows.filter((r) => r.planned != null || r.produced != null)
    : rows;

  const groups = useMemo(() => {
    const map = new Map<string, ProductionStatus[]>();
    for (const r of visible) {
      if (!map.has(r.family)) map.set(r.family, []);
      map.get(r.family)!.push(r);
    }
    return [...map.entries()];
  }, [visible]);

  const totalPlanned = rows.reduce((s, r) => s + (r.planned ?? 0), 0);
  const totalProduced = rows.reduce((s, r) => s + (r.produced ?? 0), 0);
  const registeredCount = rows.filter((r) => r.produced != null).length;

  const openEdit = (row: ProductionStatus) => {
    setEditing(row);
    setDraftQty(row.produced ?? row.planned ?? 0);
  };

  const saveProduction = async () => {
    if (!editing) return;
    setSaving(true);
    await productionService.recordProduction(editing.product_id, targetISO, draftQty);
    setSaving(false);
    setEditing(null);
    setRows((prev) =>
      prev.map((r) => (r.product_id === editing.product_id ? { ...r, produced: draftQty } : r))
    );
  };

  return (
    <Screen scrollable noPadding>
      <View style={styles.header}>
        <Text style={styles.title}>Producción</Text>
        <Text style={styles.subtitle}>
          Registra lo producido y compáralo con el plan del día
        </Text>
      </View>

      <FilterPills
        options={[
          { key: '0', label: 'Hoy' },
          { key: '-1', label: 'Ayer' },
        ]}
        selected={dayOffset}
        onSelect={(k) => setDayOffset(k as '0' | '-1')}
      />

      {/* Resumen */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryNum}>{totalPlanned.toLocaleString('es-ES')}</Text>
          <Text style={styles.summaryLabel}>planificado</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={[styles.summaryNum, { color: Colors.secondary }]}>{totalProduced.toLocaleString('es-ES')}</Text>
          <Text style={styles.summaryLabel}>producido</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={[styles.summaryNum, { color: Colors.textSecondary }]}>{registeredCount}</Text>
          <Text style={styles.summaryLabel}>productos reg.</Text>
        </View>
      </View>

      {!hasPlan && !loading && (
        <View style={styles.noticeBox}>
          <MaterialIcons name="event-note" size={20} color={Colors.info} />
          <Text style={styles.noticeText}>
            No hay plan guardado para este día. Puedes registrar producción igualmente, o crear el plan en la pestaña Planificación.
          </Text>
        </View>
      )}

      {hasPlan && (
        <View style={styles.filterRow}>
          <Pressable onPress={() => setShowOnlyPlanned((v) => !v)}>
            <Text style={styles.filterToggle}>
              {showOnlyPlanned ? 'Ver todos los productos' : 'Ver solo los del plan'}
            </Text>
          </Pressable>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingBox}>
          <MaterialIcons name="hourglass-empty" size={48} color={Colors.textMuted} />
          <Text style={styles.loadingText}>Cargando…</Text>
        </View>
      ) : (
        groups.map(([family, items]) => (
          <View key={family} style={styles.section}>
            <View style={styles.sectionPad}>
              <SectionHeader
                title={family.charAt(0).toUpperCase() + family.slice(1)}
                family={family}
              />
            </View>
            {items.map((row) => {
              const delta = row.planned != null && row.produced != null ? row.produced - row.planned : null;
              return (
                <Pressable key={row.product_id} onPress={() => openEdit(row)} style={styles.row}>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowName} numberOfLines={1}>{row.name}</Text>
                    {delta != null && delta !== 0 && (
                      <Text style={[styles.rowDelta, { color: delta > 0 ? Colors.warning : Colors.danger }]}>
                        {delta > 0 ? `+${delta} sobre plan` : `${delta} bajo plan`}
                      </Text>
                    )}
                  </View>
                  <View style={styles.qtyCol}>
                    <Text style={styles.qtyPlanned}>{row.planned ?? '—'}</Text>
                    <Text style={styles.qtyColLabel}>plan</Text>
                  </View>
                  <View style={styles.qtyCol}>
                    <Text style={[styles.qtyProduced, row.produced == null && { color: Colors.textMuted }]}>
                      {row.produced ?? '—'}
                    </Text>
                    <Text style={styles.qtyColLabel}>real</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))
      )}

      {/* Modal registro */}
      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <Pressable style={styles.backdrop} onPress={() => setEditing(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Producción real</Text>
            <Text style={styles.sheetName}>{editing?.name}</Text>
            {editing?.planned != null && (
              <Text style={styles.sheetHint}>Plan del día: {editing.planned} uds</Text>
            )}
            <View style={styles.sheetDisplay}>
              <Text style={styles.sheetNumber}>{draftQty}</Text>
              <Text style={styles.sheetUnit}>uds</Text>
            </View>
            <Stepper value={draftQty} onChange={setDraftQty} min={0} color={Colors.secondary} />
            <View style={styles.sheetActions}>
              <Button title="Cancelar" variant="ghost" onPress={() => setEditing(null)} />
              <Button title={saving ? 'Guardando…' : 'Guardar'} onPress={saveProduction} disabled={saving} />
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
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
  },
  summaryBox: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 2,
    ...Shadows.sm,
  },
  summaryNum: {
    ...Typography.numberSmall,
    color: Colors.primary,
  },
  summaryLabel: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    fontSize: 11,
  },
  noticeBox: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    backgroundColor: Colors.infoLight,
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  noticeText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    flex: 1,
  },
  filterRow: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    alignItems: 'flex-end',
  },
  filterToggle: {
    ...Typography.labelSmall,
    color: Colors.secondary,
  },
  loadingBox: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    gap: Spacing.md,
  },
  loadingText: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
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
    gap: Spacing.lg,
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    ...Typography.labelMedium,
    color: Colors.textPrimary,
  },
  rowDelta: {
    ...Typography.bodySmall,
    fontSize: 11,
  },
  qtyCol: {
    alignItems: 'center',
    minWidth: 48,
  },
  qtyPlanned: {
    ...Typography.numberSmall,
    color: Colors.textSecondary,
  },
  qtyProduced: {
    ...Typography.numberSmall,
    color: Colors.secondary,
  },
  qtyColLabel: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    fontSize: 10,
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
    ...Typography.numberCounter,
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
