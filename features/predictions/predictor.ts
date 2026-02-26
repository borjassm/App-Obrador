import type { ProductDailyMetric } from '@/features/analytics/metrics';

type PredictionInput = {
  dayOfWeek: number;
  trendWeight?: number;
  seasonalityFactor?: number;
};

export type PredictionResult = {
  productId: string;
  recommendedQty: number;
  confidence: 'low' | 'medium' | 'high';
};

export const predictDailyProduction = (
  history: ProductDailyMetric[],
  input: PredictionInput
): PredictionResult[] => {
  const trendWeight = input.trendWeight ?? 0.6;
  const seasonalityFactor = input.seasonalityFactor ?? 1;

  const grouped = history.reduce<Record<string, ProductDailyMetric[]>>((acc, item) => {
    acc[item.productId] = [...(acc[item.productId] ?? []), item];
    return acc;
  }, {});

  return Object.entries(grouped).map(([productId, rows]) => {
    const dowRows = rows.filter((row) => new Date(row.date).getDay() === input.dayOfWeek);
    const overall = rows.map((row) => row.soldQty);
    const recent = rows.slice(-14).map((row) => row.soldQty);

    const seasonalBase = dowRows.length ? dowRows.reduce((a, b) => a + b.soldQty, 0) / dowRows.length : 0;
    const trendBase = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
    const overallBase = overall.length ? overall.reduce((a, b) => a + b, 0) / overall.length : 0;

    const weighted = trendBase * trendWeight + seasonalBase * (1 - trendWeight);
    const recommendedQty = Math.max(0, Math.round((weighted || overallBase) * seasonalityFactor));

    const confidence = rows.length > 60 ? 'high' : rows.length > 20 ? 'medium' : 'low';
    return { productId, recommendedQty, confidence };
  });
};
