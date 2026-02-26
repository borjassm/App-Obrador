import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { calculateInsights, type ProductDailyMetric } from '@/features/analytics/metrics';
import { predictDailyProduction } from '@/features/predictions/predictor';

const mockMetrics: ProductDailyMetric[] = [
  { productId: 'hogaza', date: '2026-02-19', soldQty: 83, discardedQty: 9 },
  { productId: 'hogaza', date: '2026-02-20', soldQty: 81, discardedQty: 11 },
  { productId: 'croissant_mantequilla', date: '2026-02-19', soldQty: 63, discardedQty: 8 },
  { productId: 'croissant_mantequilla', date: '2026-02-20', soldQty: 68, discardedQty: 10 }
];

export default function DashboardTab() {
  const insights = useMemo(() => calculateInsights(mockMetrics), []);
  const predictions = useMemo(() => predictDailyProduction(mockMetrics, { dayOfWeek: new Date().getDay() }), []);

  return (
    <Screen>
      <Text style={{ fontSize: 22, fontWeight: '700' }}>Inteligencia operativa</Text>
      <ScrollView>
        {insights.map((insight) => {
          const next = predictions.find((x) => x.productId === insight.productId);
          return (
            <View key={insight.productId} style={{ backgroundColor: '#fff', padding: 12, marginBottom: 8 }}>
              <Text style={{ fontWeight: '700' }}>{insight.productId}</Text>
              <Text>MM7: {insight.movingAvg7.toFixed(1)} · MM30: {insight.movingAvg30.toFixed(1)}</Text>
              <Text>Ratio merma: {(insight.wasteRatio * 100).toFixed(1)}%</Text>
              <Text>Rotura stock: {insight.stockoutSignal ? 'Sí' : 'No'} · Ineficiencia: {insight.inefficiencySignal ? 'Alta' : 'Controlada'}</Text>
              <Text>Producción sugerida mañana: {next?.recommendedQty ?? 0}</Text>
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}
