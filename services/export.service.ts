import { Platform } from 'react-native';
import * as XLSX from 'xlsx';

import type { AnalyticsData } from '@/hooks/useAnalytics';

// Exporta la analítica del periodo a un Excel con hojas de resumen, ventas
// diarias, top productos y mermas. En web descarga el archivo; en nativo lo
// escribe a disco y abre el diálogo de compartir.
export async function exportAnalyticsToExcel(data: AnalyticsData, locationLabel: string) {
  const wb = XLSX.utils.book_new();

  const resumen = [
    { Concepto: 'Periodo', Valor: `${data.periodStart} a ${data.periodEnd}` },
    { Concepto: 'Ubicación', Valor: locationLabel },
    { Concepto: 'Facturación (EUR)', Valor: data.overview?.total_revenue ?? 0 },
    { Concepto: 'Unidades', Valor: data.overview?.total_units ?? 0 },
    { Concepto: 'Días con ventas', Valor: data.overview?.days_with_sales ?? 0 },
    { Concepto: 'Media diaria (EUR)', Valor: data.overview?.avg_daily_revenue ?? 0 },
    { Concepto: 'Productos activos', Valor: data.overview?.active_products ?? 0 },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen), 'Resumen');

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      data.series.map((s) => ({
        Fecha: s.sale_date,
        'Facturación (EUR)': s.revenue,
        Unidades: s.units,
      }))
    ),
    'Ventas diarias'
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      data.top.map((p, i) => ({
        '#': i + 1,
        Producto: p.name,
        Familia: p.family,
        Unidades: p.units,
        'Facturación (EUR)': p.revenue,
        'Cuota (%)': p.revenue_share,
      }))
    ),
    'Top productos'
  );

  if (data.waste.length > 0) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        data.waste.map((w) => ({
          Producto: w.name,
          Familia: w.family,
          'Tiradas (uds)': w.discarded,
          'Guardadas (uds)': w.saved,
          'Coste merma (EUR)': w.waste_cost,
          'Venta perdida (EUR)': w.lost_revenue,
        }))
      ),
      'Mermas'
    );
  }

  const filename = `analitica_${data.periodEnd}.xlsx`;

  if (Platform.OS === 'web') {
    const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const blob = new Blob([out], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    return;
  }

  const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) as string;
  const FileSystem = await import('expo-file-system/legacy');
  const Sharing = await import('expo-sharing');
  const path = FileSystem.documentDirectory + filename;
  await FileSystem.writeAsStringAsync(path, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  await Sharing.shareAsync(path, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: 'Exportar analítica',
  });
}
