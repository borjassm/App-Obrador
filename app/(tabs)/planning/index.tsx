import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';

import Badge from '@/components/Badge';
import Button from '@/components/Button';
import Card from '@/components/Card';
import CollapsibleSection, { configureCollapseAnimation } from '@/components/CollapsibleSection';
import SectionHeader from '@/components/SectionHeader';
import Stepper from '@/components/Stepper';
import { Screen } from '@/components/Screen';
import { compareFamilies } from '@/constants/families';
import { Colors, Fonts, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { addDays, isoLocal, PHASE_ORDER, type Phase } from '@/features/planning/pipelineScheduler';
import { usePipelinePlanning, type PipelineItem } from '@/hooks/usePipelinePlanning';
import { useRole } from '@/hooks/useRole';
import { planningService } from '@/services/planning.service';

const WEEKDAY_LABELS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const SALE_DAY_LABEL = ['hoy', 'mañana', 'pasado mañana'];

const PHASE_CONFIG: Record<
  Phase,
  { title: string; detail: string; color: string }
> = {
  horneado: { title: 'Hornear', detail: 'se vende hoy', color: Colors.primary },
  fermentacion: { title: 'Fermentar', detail: 'se vende mañana', color: Colors.secondary },
  amasado: { title: 'Amasar', detail: 'se vende mañana o pasado', color: Colors.familyPanaderia },
};

function factorLabel(value: number): string {
  return `×${value.toLocaleString('es-ES', { maximumFractionDigits: 2 })}`;
}

export default function PlanningTab() {
  const { isAdmin, loading: roleLoading } = useRole();

  if (roleLoading) {
    return (
      <Screen>
        <View style={styles.stateBox}>
          <MaterialIcons name="hourglass-empty" size={48} color={Colors.textMuted} />
        </View>
      </Screen>
    );
  }

  return isAdmin ? <AdminPlanning /> : <EmployeePlanning />;
}

// ---------- Vista de solo lectura (empleado): el plan guardado por el admin ----------
interface SavedPlanRow {
  plan_date: string;
  product_id: string;
  suggested_qty: number;
  override_qty: number | null;
  phase: string;
  nave_qty: number;
  tienda_qty: number;
  products: { name: string; family: string | null } | null;
}

function EmployeePlanning() {
  const [rows, setRows] = useState<SavedPlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsedPhases, setCollapsedPhases] = useState<Set<Phase>>(new Set());

  const todayISO = useMemo(() => isoLocal(new Date()), []);
  const targetDates = useMemo(() => {
    const today = new Date(todayISO + 'T12:00:00');
    return [0, 1, 2].map((n) => isoLocal(addDays(today, n)));
  }, [todayISO]);

  useEffect(() => {
    let cancelled = false;
    planningService.savedPlansDetailed(targetDates).then((data) => {
      if (!cancelled) {
        setRows(data as unknown as SavedPlanRow[]);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [targetDates]);

  const byPhase = useMemo(() => {
    const result: Record<Phase, SavedPlanRow[]> = { horneado: [], fermentacion: [], amasado: [] };
    for (const row of rows) {
      if (row.phase === 'horneado' || row.phase === 'fermentacion' || row.phase === 'amasado') {
        result[row.phase as Phase].push(row);
      }
    }
    return result;
  }, [rows]);

  const togglePhase = (phase: Phase) => {
    configureCollapseAnimation();
    setCollapsedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phase)) {
        next.delete(phase);
      } else {
        next.add(phase);
      }
      return next;
    });
  };

  const todayDate = new Date(todayISO + 'T12:00:00');
  const weekdayName = WEEKDAY_LABELS[todayDate.getDay()];
  const total = rows.length;

  return (
    <Screen scrollable>
      <View style={styles.header}>
        <Text style={styles.subtitle}>
          Trabajo de hoy, {weekdayName} {todayDate.getDate()}/{todayDate.getMonth() + 1} · solo
          lectura — el plan lo gestiona el administrador
        </Text>
        <Text style={styles.title}>Plan de producción</Text>
      </View>

      {loading ? (
        <View style={styles.stateBox}>
          <MaterialIcons name="hourglass-empty" size={48} color={Colors.textMuted} />
          <Text style={styles.stateText}>Cargando el plan…</Text>
        </View>
      ) : total === 0 ? (
        <View style={styles.stateBox}>
          <MaterialIcons name="event-note" size={48} color={Colors.textMuted} />
          <Text style={styles.stateText}>
            El administrador aún no ha guardado el plan de estos días.
          </Text>
        </View>
      ) : (
        PHASE_ORDER.map((phase) => {
          const config = PHASE_CONFIG[phase];
          const phaseRows = byPhase[phase];
          if (phaseRows.length === 0) return null;

          const families = new Map<string, SavedPlanRow[]>();
          for (const row of phaseRows) {
            const family = row.products?.family ?? 'otros';
            if (!families.has(family)) families.set(family, []);
            families.get(family)!.push(row);
          }
          const sortedFamilies = [...families.entries()].sort(([a], [b]) => compareFamilies(a, b));
          const units = phaseRows.reduce((s, r) => s + (r.override_qty ?? r.suggested_qty), 0);

          return (
            <CollapsibleSection
              key={phase}
              title={`${config.title} · ${config.detail}`}
              color={config.color}
              meta={`${phaseRows.length} prod · ${units.toLocaleString('es-ES')} uds`}
              expanded={!collapsedPhases.has(phase)}
              onToggle={() => togglePhase(phase)}
            >
              {sortedFamilies.map(([family, familyRows]) => (
                <View key={family}>
                  <SectionHeader title={family} family={family} count={familyRows.length} />
                  <View style={styles.familyList}>
                    {familyRows.map((row) => {
                      const qty = row.override_qty ?? row.suggested_qty;
                      return (
                        <Card key={`${row.plan_date}_${row.product_id}`} style={styles.rowCard} shadow="sm">
                          <View style={styles.row}>
                            <View style={styles.rowInfo}>
                              <Text style={styles.rowName} numberOfLines={1}>
                                {row.products?.name ?? 'Producto'}
                              </Text>
                              <Text style={styles.rowExplain}>
                                Nave {row.nave_qty} · Tienda {row.tienda_qty}
                              </Text>
                            </View>
                            <View style={styles.qtyBox}>
                              <Text style={styles.qtyNum}>{qty}</Text>
                              <Text style={styles.qtyLabel}>uds</Text>
                            </View>
                          </View>
                        </Card>
                      );
                    })}
                  </View>
                </View>
              ))}
            </CollapsibleSection>
          );
        })
      )}
    </Screen>
  );
}

// ---------- Vista completa (admin): pipeline con sugerencias y edición ----------
function AdminPlanning() {
  const {
    todayISO,
    pipeline,
    summary,
    loading,
    saving,
    accuracy,
    weatherToday,
    holidayToday,
    setOverride,
    clearOverride,
    setProcessDays,
    saveAll,
  } = usePipelinePlanning();

  const [collapsedPhases, setCollapsedPhases] = useState<Set<Phase>>(new Set());
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftQty, setDraftQty] = useState(0);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const todayDate = useMemo(() => new Date(todayISO + 'T12:00:00'), [todayISO]);
  const weekdayName = WEEKDAY_LABELS[todayDate.getDay()];

  const togglePhase = (phase: Phase) => {
    configureCollapseAnimation();
    setCollapsedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phase)) {
        next.delete(phase);
      } else {
        next.add(phase);
      }
      return next;
    });
  };

  const itemKey = (item: PipelineItem) => `${item.sellDate}_${item.productId}`;

  const openEdit = (item: PipelineItem) => {
    const key = itemKey(item);
    if (editingKey === key) {
      setEditingKey(null);
      return;
    }
    setEditingKey(key);
    setDraftQty(item.effectiveQty);
  };

  const applyEdit = (item: PipelineItem) => {
    if (draftQty === item.suggestedQty) {
      clearOverride(item.sellDate, item.productId);
    } else {
      setOverride(item.sellDate, item.productId, draftQty);
    }
    setEditingKey(null);
  };

  const resetOverride = (item: PipelineItem) => {
    clearOverride(item.sellDate, item.productId);
    setEditingKey(null);
  };

  const changeProcessDays = async (item: PipelineItem, days: number) => {
    if (days === item.processDays) return;
    setEditingKey(null);
    const { error } = await setProcessDays(item.productId, days);
    if (error) Alert.alert('Error', 'No se pudo cambiar los días de proceso.');
  };

  const handleSave = async () => {
    const { error } = await saveAll();
    if (error) {
      Alert.alert('Error', 'No se pudo guardar el plan. Inténtalo de nuevo.');
    } else {
      setSavedAt(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
    }
  };

  const totalItems =
    pipeline.horneado.length + pipeline.fermentacion.length + pipeline.amasado.length;

  const summaryLine =
    `${summary.totalProducts} productos · ${summary.totalUnits.toLocaleString('es-ES')} uds en 3 fechas` +
    (summary.overrideCount > 0
      ? ` · ${summary.overrideCount} ${summary.overrideCount === 1 ? 'ajustado' : 'ajustados'} por ti`
      : '');

  const renderItem = (item: PipelineItem) => {
    const key = itemKey(item);
    const isEditing = editingKey === key;
    const factors: string[] = [];
    if (item.weatherFactor !== 1) factors.push(`clima ${factorLabel(item.weatherFactor)}`);
    if (item.holidayFactor !== 1) factors.push(`festivo ${factorLabel(item.holidayFactor)}`);

    return (
      <Card key={key} style={styles.rowCard} shadow="sm">
        <View style={styles.row}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.rowExplain} numberOfLines={2}>
              Vende {SALE_DAY_LABEL[item.daysUntilSale]} · sugerido {item.suggestedQty}
              {factors.length > 0 ? ` · ${factors.join(' · ')}` : ''}
              {item.familyAdjusted ? ' · reducido por ajuste de su familia' : ''}
            </Text>
          </View>
          <Badge
            label={item.confidence === 'high' ? 'Alta' : item.confidence === 'medium' ? 'Media' : 'Baja'}
            variant={item.confidence === 'high' ? 'success' : item.confidence === 'medium' ? 'warning' : 'neutral'}
          />
          <View style={styles.qtyBox}>
            <Text style={[styles.qtyNum, item.overrideQty != null && styles.qtyNumAdjusted]}>
              {item.effectiveQty}
            </Text>
            <Text style={[styles.qtyLabel, item.overrideQty != null && styles.qtyLabelAdjusted]}>
              {item.overrideQty != null ? 'ajustado' : item.familyAdjusted ? 'familia' : 'sugerido'}
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

        {isEditing && (
          <View style={styles.editArea}>
            <Text style={styles.editHint}>
              Sugerido: {item.suggestedQty} uds · reparto {item.naveQty} Nave / {item.tiendaQty} Tienda
            </Text>
            <Stepper value={draftQty} onChange={setDraftQty} min={0} color={Colors.secondary} />
            <View style={styles.processRow}>
              <Text style={styles.processLabel}>Proceso</Text>
              {[1, 2, 3].map((d) => (
                <Pressable
                  key={d}
                  onPress={() => changeProcessDays(item, d)}
                  style={({ pressed }) => [
                    styles.processPill,
                    item.processDays === d && styles.processPillActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.processPillText,
                      item.processDays === d && styles.processPillTextActive,
                    ]}
                  >
                    {d} {d === 1 ? 'día' : 'días'}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.editActions}>
              {item.overrideQty != null && (
                <Button
                  title="Resetear"
                  variant="ghost"
                  onPress={() => resetOverride(item)}
                  style={styles.editActionBtn}
                />
              )}
              <Button
                title="Cancelar"
                variant="ghost"
                onPress={() => setEditingKey(null)}
                style={styles.editActionBtn}
              />
              <Button title="Aplicar" onPress={() => applyEdit(item)} style={styles.editActionBtn} />
            </View>
          </View>
        )}
      </Card>
    );
  };

  const renderPhase = (phase: Phase) => {
    const config = PHASE_CONFIG[phase];
    const phaseItems = pipeline[phase];
    if (phaseItems.length === 0) return null;

    const units = summary.unitsByPhase[phase];
    const families = new Map<string, PipelineItem[]>();
    for (const item of phaseItems) {
      if (!families.has(item.family)) families.set(item.family, []);
      families.get(item.family)!.push(item);
    }
    const sortedFamilies = [...families.entries()].sort(([a], [b]) => compareFamilies(a, b));

    return (
      <View key={phase} style={styles.phaseBlock}>
        <CollapsibleSection
          title={`${config.title} · ${config.detail}`}
          color={config.color}
          meta={`${phaseItems.length} prod · ${units.toLocaleString('es-ES')} uds`}
          expanded={!collapsedPhases.has(phase)}
          onToggle={() => togglePhase(phase)}
        >
          {sortedFamilies.map(([family, familyItems]) => (
            <View key={family}>
              <SectionHeader title={family} family={family} count={familyItems.length} />
              <View style={styles.familyList}>{familyItems.map(renderItem)}</View>
            </View>
          ))}
        </CollapsibleSection>
      </View>
    );
  };

  return (
    <Screen noPadding>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.subtitle}>
            Trabajo de hoy, {weekdayName} {todayDate.getDate()}/{todayDate.getMonth() + 1} — qué
            hornear, fermentar y amasar según la venta prevista
          </Text>
          <Text style={styles.title}>Plan de producción</Text>
        </View>

        {/* Contexto del día: clima y festivos */}
        {(weatherToday || holidayToday?.reason) && (
          <View style={styles.chipsRow}>
            {weatherToday && (
              <View style={styles.contextChip}>
                <MaterialIcons name="thermostat" size={16} color={Colors.textSecondary} />
                <Text style={styles.contextChipText}>
                  {Math.round(weatherToday.day.tempMax)}° · {weatherToday.day.precipitation.toLocaleString('es-ES')} mm
                  {weatherToday.factor !== 1 ? ` · demanda ${factorLabel(weatherToday.factor)}` : ''}
                </Text>
              </View>
            )}
            {holidayToday?.reason && (
              <View style={[styles.contextChip, styles.contextChipWarning]}>
                <MaterialIcons name="event" size={16} color={Colors.warning} />
                <Text style={[styles.contextChipText, { color: Colors.warning }]}>
                  {holidayToday.reason} · demanda {factorLabel(holidayToday.factor)}
                </Text>
              </View>
            )}
          </View>
        )}

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

        {/* Resumen por fase */}
        {!loading && totalItems > 0 && (
          <View style={styles.phaseSummaryRow}>
            {PHASE_ORDER.map((phase) => (
              <View key={phase} style={styles.phaseSummaryCard}>
                <View style={[styles.phaseDot, { backgroundColor: PHASE_CONFIG[phase].color }]} />
                <Text style={styles.phaseSummaryValue}>
                  {summary.unitsByPhase[phase].toLocaleString('es-ES')}
                </Text>
                <Text style={styles.phaseSummaryLabel}>{PHASE_CONFIG[phase].title}</Text>
              </View>
            ))}
          </View>
        )}

        {loading ? (
          <View style={styles.stateBox}>
            <MaterialIcons name="hourglass-empty" size={48} color={Colors.textMuted} />
            <Text style={styles.stateText}>Calculando el pipeline…</Text>
          </View>
        ) : totalItems === 0 ? (
          <View style={styles.stateBox}>
            <MaterialIcons name="event-note" size={48} color={Colors.textMuted} />
            <Text style={styles.stateText}>
              Sin histórico de ventas para sugerir. Importa ventas del ERP.
            </Text>
          </View>
        ) : (
          <View style={styles.phases}>{PHASE_ORDER.map(renderPhase)}</View>
        )}
      </ScrollView>

      {/* Footer fijo */}
      {!loading && totalItems > 0 && (
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
            onPress={handleSave}
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
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.xs,
  },
  contextChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  contextChipWarning: {
    backgroundColor: Colors.warningLight,
    borderColor: Colors.warningLight,
  },
  contextChipText: {
    ...Typography.meta,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
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
  // Resumen por fase
  phaseSummaryRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
  },
  phaseSummaryCard: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingVertical: Spacing.md,
  },
  phaseDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
    marginBottom: 2,
  },
  phaseSummaryValue: {
    ...Typography.numberSmall,
    color: Colors.textPrimary,
  },
  phaseSummaryLabel: {
    ...Typography.meta,
    fontSize: 11,
  },
  // Estados
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
  // Fases y familias
  phases: {
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
  },
  phaseBlock: {
    marginBottom: Spacing.xs,
  },
  familyList: {
    gap: Spacing.sm,
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
    fontVariant: ['tabular-nums'],
  },
  processRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  processLabel: {
    ...Typography.meta,
    marginRight: Spacing.xs,
  },
  processPill: {
    minHeight: 36,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  processPillActive: {
    backgroundColor: Colors.primaryTint,
    borderColor: Colors.primary,
  },
  processPillText: {
    ...Typography.labelMedium,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  processPillTextActive: {
    color: Colors.primary,
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
