import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import Button from '@/components/Button';
import Card from '@/components/Card';
import { Screen } from '@/components/Screen';
import Stepper from '@/components/Stepper';
import FilterPills from '@/components/FilterPills';
import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useStock } from '@/hooks/useStock';

type Tab = 'ingredientes' | 'producto';

interface CountTarget {
  kind: Tab;
  id: string;
  name: string;
  unit: string;
  current: number;
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

  const [tab, setTab] = useState<Tab>('ingredientes');
  const [target, setTarget] = useState<CountTarget | null>(null);
  const [draftQty, setDraftQty] = useState(0);
  const [saving, setSaving] = useState(false);

  const openCount = (t: CountTarget) => {
    setTarget(t);
    setDraftQty(t.current);
  };

  const saveCount = async () => {
    if (!target) return;
    setSaving(true);
    if (target.kind === 'ingredientes') {
      await recordIngredientCount(target.id, draftQty);
    } else {
      await recordProductCount(target.id, draftQty);
    }
    setSaving(false);
    setTarget(null);
  };

  return (
    <Screen>
      <View style={styles.headerArea}>
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

      {loading ? (
        <View style={styles.center}>
          <Text style={styles.muted}>Cargando stock…</Text>
        </View>
      ) : tab === 'ingredientes' ? (
        <View style={styles.list}>
          {lowCount > 0 && (
            <View style={styles.alertBanner}>
              <Text style={styles.alertText}>
                ⚠️ {lowCount} ingrediente{lowCount > 1 ? 's' : ''} por debajo del mínimo
              </Text>
            </View>
          )}
          {ingredients.map((i) => (
            <Card key={i.id} onPress={() => openCount({ kind: 'ingredientes', id: i.id, name: i.name, unit: i.unit, current: i.current_stock })} shadow="sm" style={styles.row}>
              <View style={styles.rowInfo}>
                <Text style={styles.rowName}>{i.name}</Text>
                <Text style={styles.rowSub}>
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
              {i.is_low && (
                <View style={styles.lowBadge}>
                  <Text style={styles.lowBadgeText}>BAJO</Text>
                </View>
              )}
            </Card>
          ))}
        </View>
      ) : (
        <View style={styles.list}>
          <Text style={styles.hint}>
            Stock actual según el último recuento manual. Toca un producto para registrar el recuento de hoy.
          </Text>
          {products.map((p) => (
            <Card key={p.id} onPress={() => openCount({ kind: 'producto', id: p.id, name: p.name, unit: 'uds', current: p.current_stock })} shadow="sm" style={styles.row}>
              <View style={styles.rowInfo}>
                <Text style={styles.rowName}>{p.name}</Text>
                <Text style={styles.rowSub}>
                  {p.family ?? 'otros'}
                  {p.last_count_date ? ` · contado ${p.last_count_date}` : ' · sin recuento'}
                </Text>
              </View>
              <View style={styles.rowRight}>
                <Text style={styles.stockNum}>{p.current_stock}</Text>
                <Text style={styles.stockUnit}>uds</Text>
              </View>
            </Card>
          ))}
        </View>
      )}

      {/* Modal de recuento */}
      <Modal visible={!!target} transparent animationType="slide" onRequestClose={() => setTarget(null)}>
        <Pressable style={styles.backdrop} onPress={() => setTarget(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Recuento de stock</Text>
            <Text style={styles.sheetName}>{target?.name}</Text>
            <View style={styles.sheetDisplay}>
              <Text style={styles.sheetNumber}>{draftQty}</Text>
              <Text style={styles.sheetUnit}>{target?.unit}</Text>
            </View>
            <Stepper value={draftQty} onChange={setDraftQty} min={0} color={Colors.primary} />
            <View style={styles.sheetActions}>
              <Button title="Cancelar" variant="ghost" onPress={() => setTarget(null)} />
              <Button title={saving ? 'Guardando…' : 'Guardar recuento'} onPress={saveCount} disabled={saving} />
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
  title: {
    ...Typography.displayMedium,
    color: Colors.textPrimary,
    paddingHorizontal: Spacing.lg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muted: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
  },
  list: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  hint: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    marginBottom: Spacing.xs,
  },
  alertBanner: {
    backgroundColor: Colors.dangerLight,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  alertText: {
    ...Typography.labelMedium,
    color: Colors.danger,
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
    ...Typography.labelLarge,
    color: Colors.textPrimary,
  },
  rowSub: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
  rowRight: {
    alignItems: 'flex-end',
  },
  stockNum: {
    ...Typography.numberSmall,
    color: Colors.textPrimary,
  },
  stockUnit: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    fontSize: 10,
  },
  lowBadge: {
    backgroundColor: Colors.danger,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  lowBadgeText: {
    ...Typography.labelSmall,
    color: Colors.textOnPrimary,
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
  sheetDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  sheetNumber: {
    fontSize: 56,
    fontWeight: '700',
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
    justifyContent: 'space-between',
  },
});
