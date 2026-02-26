export type ProductDailyMetric = {
  productId: string;
  date: string;
  soldQty: number;
  discardedQty: number;
};

export type ProductInsight = {
  productId: string;
  movingAvg7: number;
  movingAvg30: number;
  wasteRatio: number;
  stockoutSignal: boolean;
  inefficiencySignal: boolean;
};

const average = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

export const calculateInsights = (metrics: ProductDailyMetric[]): ProductInsight[] => {
  const byProduct = new Map<string, ProductDailyMetric[]>();
  metrics.forEach((item) => {
    byProduct.set(item.productId, [...(byProduct.get(item.productId) ?? []), item]);
  });

  return [...byProduct.entries()].map(([productId, list]) => {
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const sold = sorted.map((x) => x.soldQty);
    const discarded = sorted.map((x) => x.discardedQty);
    const latest7 = sold.slice(-7);
    const latest30 = sold.slice(-30);
    const totalSold = sold.reduce((a, b) => a + b, 0);
    const totalDiscarded = discarded.reduce((a, b) => a + b, 0);
    const wasteRatio = totalSold + totalDiscarded === 0 ? 0 : totalDiscarded / (totalSold + totalDiscarded);

    return {
      productId,
      movingAvg7: average(latest7),
      movingAvg30: average(latest30),
      wasteRatio,
      stockoutSignal: average(latest7) > average(latest30) * 1.15,
      inefficiencySignal: wasteRatio >= 0.2
    };
  });
};
