import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';

import Button from '@/components/Button';
import Card from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { importErpCsv, type ImportResult } from '@/services/erpImport.service';

async function readTextFromUri(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    return await res.text();
  }
  const FileSystem = await import('expo-file-system/legacy');
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
}

export default function ImportErpScreen() {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ pct: number; message: string } | null>(null);
  const [results, setResults] = useState<{ fileName: string; result: ImportResult }[]>([]);

  const pickAndImport = async () => {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/vnd.ms-excel', '*/*'],
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets?.length) return;

    setBusy(true);
    setResults([]);
    const collected: { fileName: string; result: ImportResult }[] = [];

    for (let i = 0; i < picked.assets.length; i++) {
      const asset = picked.assets[i];
      const prefix = picked.assets.length > 1 ? `[${i + 1}/${picked.assets.length}] ` : '';
      try {
        setProgress({ pct: 0, message: `${prefix}Leyendo ${asset.name}…` });
        const text = await readTextFromUri(asset.uri);
        const result = await importErpCsv(text, (pct, message) =>
          setProgress({ pct, message: prefix + message })
        );
        collected.push({ fileName: asset.name, result });
      } catch (e) {
        collected.push({
          fileName: asset.name,
          result: {
            rowsRead: 0, rowsExcluded: 0, aggregated: 0, productsCreated: 0,
            locationsCreated: 0, upserted: 0, dateRange: null,
            errors: ['No se pudo leer el archivo: ' + String(e)],
          },
        });
      }
    }

    setResults(collected);
    setProgress(null);
    setBusy(false);
  };

  const totals = results.reduce(
    (acc, r) => ({
      upserted: acc.upserted + r.result.upserted,
      products: acc.products + r.result.productsCreated,
      errors: acc.errors + r.result.errors.length,
    }),
    { upserted: 0, products: 0, errors: 0 }
  );

  return (
    <Screen scrollable>
      <View style={styles.header}>
        <Text style={styles.title}>⬆️ Importar ventas del ERP</Text>
        <Text style={styles.subtitle}>
          Selecciona una o varias exportaciones CSV del ERP (separadas por «;»). Se agregan por día,
          tienda y producto, y se cargan sin duplicar: puedes re-importar el mismo archivo sin miedo.
        </Text>
      </View>

      <Card style={styles.infoCard} shadow="sm">
        <Text style={styles.infoTitle}>Qué hace la importación</Text>
        <Text style={styles.infoLine}>• Excluye automáticamente los establecimientos «SIN USO».</Text>
        <Text style={styles.infoLine}>• Crea productos y tiendas nuevos si aparecen en el archivo.</Text>
        <Text style={styles.infoLine}>• Alimenta la analítica y las predicciones al momento.</Text>
      </Card>

      <View style={styles.actionBox}>
        <Button
          title={busy ? 'Importando…' : 'Elegir archivos CSV'}
          onPress={pickAndImport}
          disabled={busy}
        />
      </View>

      {progress && (
        <View style={styles.progressBox}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress.pct}%` }]} />
          </View>
          <Text style={styles.progressText}>{progress.message}</Text>
        </View>
      )}

      {results.length > 0 && (
        <View style={styles.results}>
          <Card style={styles.summaryCard} shadow="sm">
            <Text style={styles.summaryTitle}>
              {totals.errors === 0 ? '✅ Importación completada' : '⚠️ Importación con avisos'}
            </Text>
            <Text style={styles.summaryLine}>
              {totals.upserted.toLocaleString('es-ES')} registros de venta cargados
              {totals.products > 0 ? ` · ${totals.products} productos nuevos creados` : ''}
            </Text>
          </Card>

          {results.map((r, i) => (
            <Card key={i} style={styles.fileCard} shadow="sm">
              <Text style={styles.fileName}>{r.fileName}</Text>
              {r.result.dateRange && (
                <Text style={styles.fileLine}>
                  Periodo: {r.result.dateRange.from} → {r.result.dateRange.to}
                </Text>
              )}
              <Text style={styles.fileLine}>
                {r.result.rowsRead.toLocaleString('es-ES')} líneas · {r.result.rowsExcluded.toLocaleString('es-ES')} excluidas ·{' '}
                {r.result.aggregated.toLocaleString('es-ES')} totales diarios · {r.result.upserted.toLocaleString('es-ES')} guardados
              </Text>
              {r.result.errors.map((e, j) => (
                <Text key={j} style={styles.fileError}>⚠️ {e}</Text>
              ))}
            </Card>
          ))}

          <View style={styles.actionBox}>
            <Button title="Ver analítica" variant="secondary" onPress={() => router.push('/(tabs)/dashboard')} />
          </View>
        </View>
      )}

      <View style={styles.footer}>
        <Button title="Volver" variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: Spacing.xl,
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.headingLarge,
    color: Colors.textPrimary,
  },
  subtitle: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  infoCard: {
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  infoTitle: {
    ...Typography.labelMedium,
    color: Colors.textPrimary,
  },
  infoLine: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  actionBox: {
    marginVertical: Spacing.md,
  },
  progressBox: {
    gap: Spacing.sm,
    marginVertical: Spacing.md,
  },
  progressTrack: {
    height: 8,
    backgroundColor: Colors.borderLight,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.secondary,
    borderRadius: Radius.full,
  },
  progressText: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  results: {
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  summaryCard: {
    gap: Spacing.xs,
    backgroundColor: Colors.successLight,
  },
  summaryTitle: {
    ...Typography.labelLarge,
    color: Colors.textPrimary,
  },
  summaryLine: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
  },
  fileCard: {
    gap: 4,
  },
  fileName: {
    ...Typography.labelMedium,
    color: Colors.textPrimary,
  },
  fileLine: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
  fileError: {
    ...Typography.bodySmall,
    color: Colors.danger,
  },
  footer: {
    paddingVertical: Spacing.xl,
  },
});
