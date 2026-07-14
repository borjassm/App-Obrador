import { useMemo, useState, type ComponentProps } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import Button from '@/components/Button';
import Card from '@/components/Card';
import { Screen } from '@/components/Screen';
import Stepper from '@/components/Stepper';
import FilterPills from '@/components/FilterPills';
import { Colors, getFamilyColor, Radius, Shadows, Spacing, TABLET_BREAKPOINT, Typography } from '@/constants/theme';
import { useStock } from '@/hooks/useStock';
import type { IngredientStock, ProductStock } from '@/services/stock.service';

type Tab = 'ingredientes' | 'producto';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

interface CountTarget {
  kind: Tab;
  id: string;
  name: string;
  unit: string;
  current: number;
}

interface Section<T> {
  key: string;
  title: string;
  items: T[];
  lowCount: number;
}

/** Icono por categoría de ingrediente (MaterialIcons) */
function categoryIcon(category: string | null): IconName {
  const c = (category ?? '').toLowerCase();
  if (c.includes('harina') || c.includes('cereal')) return 'grain';
  if (c.includes('levadura') || c.includes('aditiv') || c.includes('impulsor')) return 'science';
  if (c.includes('lact') || c.includes('láct') || c.includes('leche') || c.includes('mantequilla') || c.includes('nata')) return 'breakfast-dining';
  if (c.includes('azucar') || c.includes('azúcar') || c.includes('chocolat') || c.includes('cacao') || c.includes('dulce')) return 'cookie';
  if (c.includes('huevo')) return 'egg';
  return 'inventory-2';
}

// ── Fechas (es-ES corto, sin depender de Intl) ─────────────────────────────
const DAY_NAMES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MONTH_NAMES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse a mediodía local para evitar saltos por DST */
function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

function shiftISODate(iso: string, deltaDays: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + deltaDays);
  return toISODate(d);
}

/** "mar 14 jul" */
function formatShortEs(iso: string): string {
  const d = parseISODate(iso);
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

function groupIngredients(ingredients: IngredientStock[]): Section<IngredientStock>[] {
  const map = new Map<string, IngredientStock[]>();
  for (const i of ingredients) {
    const cat = i.category ?? 'Otros';
    const arr = map.get(cat);
    if (arr) arr.push(i);
    else map.set(cat, [i]);
  }
  const sections = [...map.entries()].map(([title, items]) => ({
    key: `ing:${title}`,
    title,
    items,
    lowCount: items.filter((x) => x.is_low).length,
  }));
  sections.sort((a, b) =>
    a.title === 'Otros' ? 1 : b.title === 'Otros' ? -1 : a.title.localeCompare(b.title, 'es')
  );
  return sections;
}

function groupProducts(products: ProductStock[]): Section<ProductStock>[] {
  const map = new Map<string, ProductStock[]>();
  for (const p of products) {
    const fam = p.family ?? 'Otros';
    const arr = map.get(fam);
    if (arr) arr.push(p);
    else map.set(fam, [p]);
  }
  const sections = [...map.entries()].map(([title, items]) => ({
    key: `prod:${title}`,
    title,
    items,
    lowCount: 0,
  }));
  sections.sort((a, b) =>
    a.title === 'Otros' ? 1 : b.title === 'Otros' ? -1 : a.title.localeCompare(b.title, 'es')
  );
  return sections;
}

export default function StockScreen() {
  const {
    ingredients,
    products,
    loading,
    lowCount,
    recordIngredientCount,
    recordProductCount,
  } = useStock();

  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;

  const [tab, setTab] = useState<Tab>('ingredientes');
  const [onlyLow, setOnlyLow] = useState(false);
  const [target, setTarget] = useState<CountTarget | null>(null);
  const [draftQty, setDraftQty] = useState(0);
  const [saving, setSaving] = useState(false);

  // Día del recuento (por defecto hoy, nunca futuro)
  const todayISO = toISODate(new Date());
  const [dateISO, setDateISO] = useState(todayISO);
  const isToday = dateISO === todayISO;

  // Secciones colapsables: override manual sobre el estado por defecto
  // (por defecto abierta solo si la sección tiene artículos bajos)
  const [expandedOverrides, setExpandedOverrides] = useState<Record<string, boolean>>({});

  const ingredientSections = useMemo(() => groupIngredients(ingredients), [ingredients]);
  const productSections = useMemo(() => groupProducts(products), [products]);

  const isExpanded = (key: string, defaultOpen: boolean) => expandedOverrides[key] ?? defaultOpen;

  const toggleSection = (key: string, defaultOpen: boolean) => {
    setExpandedOverrides((prev) => ({ ...prev, [key]: !(prev[key] ?? defaultOpen) }));
  };

  const openCount = (t: CountTarget) => {
    setTarget(t);
    setDraftQty(t.current);
  };

  const saveCount = async () => {
    if (!target) return;
    setSaving(true);
    if (target.kind === 'ingredientes') {
      await recordIngredientCount(target.id, draftQty, dateISO);
    } else {
      await recordProductCount(target.id, draftQty, dateISO);
    }
    setSaving(false);
    setTarget(null);
  };

  const showOnlyLow = onlyLow && lowCount > 0;
  const visibleIngredients = showOnlyLow ? ingredients.filter((i) => i.is_low) : ingredients;

  const renderIngredientRow = (i: IngredientStock) => (
    <Card
      key={i.id}
      onPress={() =>
        openCount({ kind: 'ingredientes', id: i.id, name: i.name, unit: i.unit, current: i.current_stock })
      }
      shadow="sm"
      style={i.is_low ? { ...styles.row, ...styles.rowLow } : styles.row}
    >
      <View style={[styles.iconTile, i.is_low && styles.iconTileLow]}>
        <MaterialIcons
          name={categoryIcon(i.category)}
          size={24}
          color={i.is_low ? Colors.danger : Colors.primary}
        />
      </View>
      <View style={styles.rowInfo}>
        <View style={styles.rowNameLine}>
          <Text style={styles.rowName} numberOfLines={1}>{i.name}</Text>
          {i.is_low && (
            <View style={styles.lowBadge}>
              <Text style={styles.lowBadgeText}>BAJO</Text>
            </View>
          )}
        </View>
        <Text style={styles.rowSub} numberOfLines={1}>
          {i.category ?? 'sin categoría'}
          {i.min_stock_level != null ? ` · mín. ${i.min_stock_level} ${i.unit}` : ''}
          {i.last_count_date ? ` · contado ${i.last_count_date}` : ' · sin recuento'}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={[styles.stockNum, i.is_low && { color: Colors.danger }]}>
          {i.current_stock}
        </Text>
        <Text style={styles.stockUnit}>{i.unit}</Text>
      </View>
      <Pressable
        onPress={() =>
          openCount({ kind: 'ingredientes', id: i.id, name: i.name, unit: i.unit, current: i.current_stock })
        }
        hitSlop={{ top: 8, bottom: 8 }}
        style={({ pressed }) => [styles.countBtn, pressed && styles.pressed]}
      >
        <MaterialIcons name="edit" size={18} color={Colors.primary} />
        <Text style={styles.countBtnText}>Contar</Text>
      </Pressable>
    </Card>
  );

  const renderProductRow = (p: ProductStock) => (
    <Card
      key={p.id}
      onPress={() =>
        openCount({ kind: 'producto', id: p.id, name: p.name, unit: 'uds', current: p.current_stock })
      }
      shadow="sm"
      style={styles.row}
    >
      <View style={styles.iconTile}>
        <MaterialIcons name="breakfast-dining" size={24} color={Colors.primary} />
      </View>
      <View style={styles.rowInfo}>
        <View style={styles.rowNameLine}>
          <Text style={styles.rowName} numberOfLines={1}>{p.name}</Text>
        </View>
        <Text style={styles.rowSub} numberOfLines={1}>
          {p.family ?? 'otros'}
          {p.last_count_date ? ` · contado ${p.last_count_date}` : ' · sin recuento'}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.stockNum}>{p.current_stock}</Text>
        <Text style={styles.stockUnit}>uds</Text>
      </View>
      <Pressable
        onPress={() =>
          openCount({ kind: 'producto', id: p.id, name: p.name, unit: 'uds', current: p.current_stock })
        }
        hitSlop={{ top: 8, bottom: 8 }}
        style={({ pressed }) => [styles.countBtn, pressed && styles.pressed]}
      >
        <MaterialIcons name="edit" size={18} color={Colors.primary} />
        <Text style={styles.countBtnText}>Contar</Text>
      </Pressable>
    </Card>
  );

  const renderSectionHeader = (
    section: Section<IngredientStock> | Section<ProductStock>,
    familyDot?: boolean
  ) => {
    const defaultOpen = section.lowCount > 0;
    const open = isExpanded(section.key, defaultOpen);
    return (
      <Pressable
        onPress={() => toggleSection(section.key, defaultOpen)}
        style={({ pressed }) => [styles.sectionHeader, pressed && styles.pressed]}
      >
        {familyDot && (
          <View style={[styles.familyDot, { backgroundColor: getFamilyColor(section.title) }]} />
        )}
        <Text style={styles.sectionTitle} numberOfLines={1}>{section.title}</Text>
        <Text style={styles.sectionCount}>
          {section.items.length} artículo{section.items.length !== 1 ? 's' : ''}
        </Text>
        {section.lowCount > 0 && (
          <View style={styles.lowBadge}>
            <Text style={styles.lowBadgeText}>
              {section.lowCount} BAJO{section.lowCount > 1 ? 'S' : ''}
            </Text>
          </View>
        )}
        <MaterialIcons
          name={open ? 'expand-less' : 'expand-more'}
          size={26}
          color={Colors.textSecondary}
        />
      </Pressable>
    );
  };

  const dateLabel = isToday ? `Hoy · ${formatShortEs(dateISO)}` : formatShortEs(dateISO);

  return (
    <Screen scrollable>
      <View style={[styles.headerArea, isTablet && styles.headerAreaTablet]}>
        <Text style={styles.title}>Stock</Text>
        <FilterPills
          options={[
            { key: 'ingredientes', label: 'Ingredientes' },
            { key: 'producto', label: 'Producto terminado' },
          ]}
          selected={tab}
          onSelect={(k) => setTab(k as Tab)}
        />
      </View>

      {/* Selector de día del recuento */}
      <View style={styles.dateRow}>
        <Pressable
          onPress={() => setDateISO(shiftISODate(dateISO, -1))}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Día anterior"
          style={({ pressed }) => [styles.dateArrow, pressed && styles.pressed]}
        >
          <MaterialIcons name="chevron-left" size={26} color={Colors.textPrimary} />
        </Pressable>
        <View style={[styles.dateChip, !isToday && styles.dateChipPast]}>
          <MaterialIcons
            name={isToday ? 'event' : 'history'}
            size={18}
            color={isToday ? Colors.primary : Colors.warning}
          />
          <Text style={[styles.dateChipText, !isToday && styles.dateChipTextPast]}>
            {dateLabel}
          </Text>
        </View>
        <Pressable
          onPress={() => setDateISO(shiftISODate(dateISO, 1))}
          disabled={isToday}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Día siguiente"
          style={({ pressed }) => [styles.dateArrow, isToday && styles.dateArrowDisabled, pressed && styles.pressed]}
        >
          <MaterialIcons
            name="chevron-right"
            size={26}
            color={isToday ? Colors.textMuted : Colors.textPrimary}
          />
        </Pressable>
        {!isToday && (
          <Pressable
            onPress={() => setDateISO(todayISO)}
            hitSlop={{ top: 8, bottom: 8 }}
            style={({ pressed }) => [styles.todayBtn, pressed && styles.pressed]}
          >
            <MaterialIcons name="today" size={16} color={Colors.textOnPrimary} />
            <Text style={styles.todayBtnText}>Hoy</Text>
          </Pressable>
        )}
      </View>

      {/* Aviso: registrando en fecha pasada */}
      {!isToday && (
        <View style={styles.dateWarning}>
          <MaterialIcons name="history" size={22} color={Colors.warning} />
          <Text style={styles.dateWarningText}>
            Estás registrando recuentos del {formatShortEs(dateISO)}, no de hoy. Se guardarán con
            esa fecha. La lista sigue mostrando el stock actual (último recuento por artículo).
          </Text>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <Text style={styles.muted}>Cargando stock…</Text>
        </View>
      ) : tab === 'ingredientes' ? (
        <View style={styles.list}>
          {lowCount > 0 && (
            <View style={styles.alertBanner}>
              <MaterialIcons name="warning" size={22} color={Colors.danger} />
              <Text style={styles.alertText}>
                {lowCount} ingrediente{lowCount > 1 ? 's' : ''} por debajo del mínimo
              </Text>
              <Pressable
                onPress={() => setOnlyLow((v) => !v)}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                style={({ pressed }) => [styles.alertPill, pressed && styles.pressed]}
              >
                <Text style={styles.alertPillText}>
                  {onlyLow ? 'Ver todos' : 'Ver solo bajos'}
                </Text>
              </Pressable>
            </View>
          )}
          {showOnlyLow
            ? visibleIngredients.map(renderIngredientRow)
            : ingredientSections.map((section) => (
                <View key={section.key} style={styles.section}>
                  {renderSectionHeader(section)}
                  {isExpanded(section.key, section.lowCount > 0) &&
                    section.items.map(renderIngredientRow)}
                </View>
              ))}
        </View>
      ) : (
        <View style={styles.list}>
          <Text style={styles.hint}>
            Stock actual según el último recuento manual. Toca un producto para registrar un recuento.
          </Text>
          {productSections.map((section) => (
            <View key={section.key} style={styles.section}>
              {renderSectionHeader(section, true)}
              {isExpanded(section.key, section.lowCount > 0) &&
                section.items.map(renderProductRow)}
            </View>
          ))}
        </View>
      )}

      {/* Modal de recuento */}
      <Modal visible={!!target} transparent animationType="slide" onRequestClose={() => setTarget(null)}>
        <Pressable style={styles.backdrop} onPress={() => setTarget(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Recuento de stock</Text>
            <Text style={styles.sheetName}>{target?.name}</Text>
            <View style={[styles.sheetDateChip, !isToday && styles.sheetDateChipPast]}>
              <MaterialIcons
                name={isToday ? 'event' : 'history'}
                size={16}
                color={isToday ? Colors.textMuted : Colors.warning}
              />
              <Text style={[styles.sheetDateText, !isToday && styles.sheetDateTextPast]}>
                {isToday ? dateLabel : `Recuento del ${formatShortEs(dateISO)}`}
              </Text>
            </View>
            <View style={styles.sheetDisplay}>
              <Text style={styles.sheetNumber}>{draftQty}</Text>
              <Text style={styles.sheetUnit}>{target?.unit}</Text>
            </View>
            <Stepper value={draftQty} onChange={setDraftQty} min={0} color={Colors.primary} />
            <View style={styles.sheetActions}>
              <Button title="Cancelar" variant="ghost" onPress={() => setTarget(null)} style={styles.sheetBtnCancel} />
              <Button
                title={saving ? 'Guardando…' : 'Guardar recuento'}
                onPress={saveCount}
                disabled={saving}
                style={styles.sheetBtnSave}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerArea: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  headerAreaTablet: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...Typography.displayMedium,
    color: Colors.textPrimary,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxxl,
  },
  muted: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
  },
  // ── Selector de día ──
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  dateArrow: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateArrowDisabled: {
    opacity: 0.4,
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 44,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryTint,
  },
  dateChipPast: {
    backgroundColor: Colors.warningLight,
  },
  dateChipText: {
    ...Typography.labelMedium,
    color: Colors.primary,
  },
  dateChipTextPast: {
    color: '#8A5314',
  },
  todayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    minHeight: 44,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
  todayBtnText: {
    ...Typography.labelMedium,
    color: Colors.textOnPrimary,
  },
  dateWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.warningLight,
    borderWidth: 1,
    borderColor: 'rgba(199, 123, 33, 0.35)',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
  },
  dateWarningText: {
    flex: 1,
    fontFamily: Typography.labelMedium.fontFamily,
    fontSize: 14.5,
    lineHeight: 20,
    color: '#8A5314',
  },
  // ── Listas y secciones ──
  list: {
    gap: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  section: {
    gap: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 56,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  familyDot: {
    width: 10,
    height: 10,
    borderRadius: Radius.full,
  },
  sectionTitle: {
    ...Typography.headingMedium,
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  sectionCount: {
    ...Typography.meta,
    flex: 1,
  },
  hint: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    marginBottom: Spacing.xs,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.dangerLight,
    borderWidth: 1,
    borderColor: 'rgba(194, 75, 51, 0.25)',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  alertText: {
    flex: 1,
    fontFamily: Typography.labelMedium.fontFamily,
    fontSize: 14.5,
    lineHeight: 20,
    color: '#8F3421',
  },
  alertPill: {
    minHeight: 44,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertPillText: {
    ...Typography.labelMedium,
    fontSize: 13,
    color: Colors.textOnPrimary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    borderRadius: Radius.lg,
    paddingVertical: 18,
    paddingHorizontal: Spacing.xl,
    minHeight: 56,
  },
  rowLow: {
    borderWidth: 1.5,
    borderColor: 'rgba(194, 75, 51, 0.4)',
  },
  iconTile: {
    width: 46,
    height: 46,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconTileLow: {
    backgroundColor: Colors.dangerLight,
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  rowNameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rowName: {
    ...Typography.headingMedium,
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  rowSub: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
  rowRight: {
    alignItems: 'flex-end',
    minWidth: 64,
  },
  stockNum: {
    ...Typography.numberLarge,
    color: Colors.textPrimary,
  },
  stockUnit: {
    ...Typography.meta,
  },
  lowBadge: {
    backgroundColor: Colors.danger,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  lowBadgeText: {
    fontFamily: Typography.numberLarge.fontFamily,
    fontSize: 11.5,
    lineHeight: 14,
    letterSpacing: 0.4,
    color: Colors.textOnPrimary,
  },
  countBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    height: 48,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryTint,
  },
  countBtnText: {
    ...Typography.labelMedium,
    color: Colors.primary,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
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
    paddingBottom: Spacing.xxl,
    gap: Spacing.lg,
    alignItems: 'center',
    ...Shadows.lg,
  },
  sheetTitle: {
    ...Typography.sectionLabel,
  },
  sheetName: {
    ...Typography.headingLarge,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  sheetDateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgBase,
  },
  sheetDateChipPast: {
    backgroundColor: Colors.warningLight,
  },
  sheetDateText: {
    ...Typography.labelMedium,
    fontSize: 13,
    color: Colors.textMuted,
  },
  sheetDateTextPast: {
    color: '#8A5314',
  },
  sheetDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  sheetNumber: {
    ...Typography.numberCounter,
    color: Colors.primary,
  },
  sheetUnit: {
    ...Typography.bodyLarge,
    color: Colors.textMuted,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignSelf: 'stretch',
  },
  sheetBtnCancel: {
    flex: 1,
  },
  sheetBtnSave: {
    flex: 2,
  },
});
