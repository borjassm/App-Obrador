import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { MaterialIcons } from '@expo/vector-icons';

import Button from '@/components/Button';
import CollapsibleSection, { configureCollapseAnimation } from '@/components/CollapsibleSection';
import { Screen } from '@/components/Screen';
import { Colors, Fonts, Radius, Spacing, Typography } from '@/constants/theme';
import {
  costService,
  parseCostCsv,
  parseCostExcel,
  type BulkImportResult,
  type CostRow,
  type ProductWithCost,
} from '@/services/cost.service';

function formatMoney(value: number | null): string {
  if (value == null) return '—';
  return `${value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function formatPct(value: number): string {
  return `${value.toLocaleString('es-ES', { maximumFractionDigits: 1 })} %`;
}

async function readCostFile(asset: DocumentPicker.DocumentPickerAsset): Promise<CostRow[]> {
  const isExcel =
    /\.xlsx?$/i.test(asset.name ?? '') ||
    (asset.mimeType ?? '').includes('sheet') ||
    (asset.mimeType ?? '').includes('ms-excel');
  if (Platform.OS === 'web') {
    const res = await fetch(asset.uri);
    return isExcel ? parseCostExcel(await res.arrayBuffer()) : parseCostCsv(await res.text());
  }
  const FileSystem = await import('expo-file-system/legacy');
  if (isExcel) {
    const base64 = await FileSystem.readAsStringAsync(asset.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return parseCostExcel(base64);
  }
  const text = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  return parseCostCsv(text);
}

export default function CostesScreen() {
  const [rows, setRows] = useState<ProductWithCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    try {
      setLoadError(null);
      const data = await costService.getProductsWithCosts();
      setRows(data);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const groups = useMemo(() => {
    const map = new Map<string, ProductWithCost[]>();
    for (const row of rows) {
      if (!map.has(row.family)) map.set(row.family, []);
      map.get(row.family)!.push(row);
    }
    return [...map.entries()].map(([family, items]) => ({
      family,
      items,
      withCost: items.filter((i) => i.unitCost != null).length,
    }));
  }, [rows]);

  const withCostTotal = useMemo(() => rows.filter((r) => r.unitCost != null).length, [rows]);
  const avgMarginPct = useMemo(() => {
    const pcts = rows.map((r) => r.marginPct).filter((v): v is number => v != null);
    if (pcts.length === 0) return null;
    return +(pcts.reduce((a, b) => a + b, 0) / pcts.length).toFixed(1);
  }, [rows]);

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

  const startEdit = (row: ProductWithCost) => {
    setEditingId(row.id);
    setEditValue(row.unitCost != null ? String(row.unitCost) : '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const value = parseFloat(editValue.trim().replace(',', '.'));
    if (Number.isNaN(value) || value <= 0) {
      Alert.alert('Coste no válido', 'Introduce un número mayor que 0 (p. ej. 0,45).');
      return;
    }
    setSaving(true);
    const { error } = await costService.upsertCost(editingId, value);
    setSaving(false);
    if (error) {
      Alert.alert('Error al guardar', error.message);
      return;
    }
    cancelEdit();
    fetchData();
  };

  const handleImport = async () => {
    const picked = await DocumentPicker.getDocumentAsync({
      type: [
        'text/csv',
        'text/comma-separated-values',
        'text/plain',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '*/*',
      ],
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets?.length) return;

    setImporting(true);
    setImportResult(null);
    try {
      const parsed = await readCostFile(picked.assets[0]);
      if (parsed.length === 0) {
        Alert.alert(
          'Archivo vacío',
          'No se encontraron filas "producto / coste". Formato esperado: nombre en la primera columna y coste en la segunda.'
        );
        return;
      }
      const result = await costService.bulkUpsertCosts(parsed);
      setImportResult(result);
      fetchData();
    } catch (e) {
      Alert.alert('Error al importar', e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  };

  const renderRow = (row: ProductWithCost) => {
    const editing = editingId === row.id;
    const marginColor =
      row.margin == null ? Colors.textMuted : row.margin >= 0 ? Colors.success : Colors.danger;
    return (
      <View key={row.id} style={styles.row}>
        <Text style={styles.rowName} numberOfLines={1}>
          {row.name}
        </Text>
        <Text style={styles.rowPrice}>{formatMoney(row.salePrice)}</Text>

        {editing ? (
          <View style={styles.editBox}>
            <TextInput
              value={editValue}
              onChangeText={setEditValue}
              keyboardType="decimal-pad"
              autoFocus
              selectTextOnFocus
              onSubmitEditing={saveEdit}
              style={styles.editInput}
              placeholder="0,00"
              placeholderTextColor={Colors.textMuted}
              editable={!saving}
            />
            <Pressable
              onPress={saveEdit}
              disabled={saving}
              hitSlop={8}
              style={({ pressed }) => [styles.editConfirm, pressed && styles.pressed]}
              accessibilityLabel={`Guardar coste de ${row.name}`}
            >
              <MaterialIcons name="check" size={20} color={Colors.textOnPrimary} />
            </Pressable>
            <Pressable
              onPress={cancelEdit}
              disabled={saving}
              hitSlop={8}
              style={({ pressed }) => [styles.editCancel, pressed && styles.pressed]}
              accessibilityLabel="Cancelar edición"
            >
              <MaterialIcons name="close" size={20} color={Colors.textSecondary} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => startEdit(row)}
            style={({ pressed }) => [styles.costCell, pressed && styles.pressed]}
            accessibilityLabel={`Editar coste de ${row.name}`}
          >
            <Text style={[styles.rowCost, row.unitCost == null && styles.rowCostEmpty]}>
              {row.unitCost != null ? formatMoney(row.unitCost) : 'añadir'}
            </Text>
            <MaterialIcons name="edit" size={16} color={Colors.primary} />
          </Pressable>
        )}

        <View style={styles.marginCell}>
          <Text style={[styles.rowMargin, { color: marginColor }]}>{formatMoney(row.margin)}</Text>
          {row.marginPct != null && (
            <Text style={[styles.rowMarginPct, { color: marginColor }]}>{formatPct(row.marginPct)}</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <Screen scrollable>
      <View style={styles.header}>
        <Text style={styles.title}>Costes</Text>
        <Text style={styles.subtitle}>
          {withCostTotal} de {rows.length} productos con coste
          {avgMarginPct != null ? ` · margen medio ${formatPct(avgMarginPct)}` : ''}
        </Text>
      </View>

      <View style={styles.importRow}>
        <Button
          title={importing ? 'Importando…' : 'Importar CSV / Excel'}
          variant="ghost"
          onPress={handleImport}
          disabled={importing}
        />
        <Text style={styles.importHint}>
          Primera columna: nombre del producto · segunda: coste unitario. El coste nuevo entra en
          vigor hoy (se conserva el histórico).
        </Text>
      </View>

      {importResult && (
        <View style={styles.resultCard}>
          <MaterialIcons
            name={importResult.unmatched.length === 0 ? 'check-circle' : 'info'}
            size={22}
            color={importResult.unmatched.length === 0 ? Colors.success : Colors.warning}
          />
          <View style={styles.resultText}>
            <Text style={styles.resultTitle}>
              {importResult.matched} coste{importResult.matched === 1 ? '' : 's'} actualizado
              {importResult.matched === 1 ? '' : 's'}
            </Text>
            {importResult.unmatched.length > 0 && (
              <Text style={styles.resultDetail}>
                Sin correspondencia ({importResult.unmatched.length}):{' '}
                {importResult.unmatched.slice(0, 10).join(', ')}
                {importResult.unmatched.length > 10
                  ? ` y ${importResult.unmatched.length - 10} más`
                  : ''}
              </Text>
            )}
          </View>
          <Pressable onPress={() => setImportResult(null)} hitSlop={8}>
            <MaterialIcons name="close" size={20} color={Colors.textMuted} />
          </Pressable>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.loadingText}>Cargando costes…</Text>
        </View>
      ) : loadError ? (
        <View style={styles.loadingBox}>
          <MaterialIcons name="error-outline" size={40} color={Colors.danger} />
          <Text style={styles.loadingText}>{loadError}</Text>
          <Button title="Reintentar" variant="ghost" onPress={fetchData} />
        </View>
      ) : (
        groups.map((group) => (
          <CollapsibleSection
            key={group.family}
            title={group.family}
            family={group.family}
            meta={`${group.withCost}/${group.items.length} con coste`}
            metaDone={group.withCost === group.items.length}
            expanded={expandedFamilies.has(group.family)}
            onToggle={() => toggleFamily(group.family)}
          >
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.colName]}>Producto</Text>
              <Text style={[styles.tableHeaderText, styles.colPrice]}>PVP</Text>
              <Text style={[styles.tableHeaderText, styles.colCost]}>Coste</Text>
              <Text style={[styles.tableHeaderText, styles.colMargin]}>Margen</Text>
            </View>
            {group.items.map(renderRow)}
          </CollapsibleSection>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.displayMedium,
    color: Colors.textPrimary,
  },
  subtitle: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    fontVariant: ['tabular-nums'],
  },
  importRow: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  importHint: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  resultText: {
    flex: 1,
    gap: 2,
  },
  resultTitle: {
    ...Typography.labelMedium,
    color: Colors.textPrimary,
  },
  resultDetail: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  loadingBox: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xxxl,
  },
  loadingText: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xs,
  },
  tableHeaderText: {
    ...Typography.meta,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  colName: { flex: 1 },
  colPrice: { width: 76, textAlign: 'right' },
  colCost: { width: 118, textAlign: 'center' },
  colMargin: { width: 96, textAlign: 'right' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 56,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  rowName: {
    ...Typography.bodyLarge,
    color: Colors.textPrimary,
    flex: 1,
  },
  rowPrice: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    width: 76,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  costCell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    width: 118,
    minHeight: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryTint,
    paddingHorizontal: Spacing.sm,
  },
  rowCost: {
    ...Typography.labelMedium,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  rowCostEmpty: {
    color: Colors.primary,
    textTransform: 'none',
  },
  editBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    width: 158,
  },
  editInput: {
    flex: 1,
    minHeight: 40,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: Colors.bgCard,
    paddingHorizontal: Spacing.sm,
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: Colors.textPrimary,
    textAlign: 'right',
  },
  editConfirm: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editCancel: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marginCell: {
    width: 96,
    alignItems: 'flex-end',
  },
  rowMargin: {
    ...Typography.labelMedium,
    fontVariant: ['tabular-nums'],
  },
  rowMarginPct: {
    ...Typography.meta,
    fontVariant: ['tabular-nums'],
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
