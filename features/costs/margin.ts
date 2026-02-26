export type ProductCost = {
  unitCost: number;
  packagingCost: number;
  laborCost: number;
  overheadCost: number;
};

export const calculateUnitMargin = (salePrice: number, cost: ProductCost) => {
  const totalCost = cost.unitCost + cost.packagingCost + cost.laborCost + cost.overheadCost;
  return salePrice - totalCost;
};

export const efficiencyRanking = (
  products: Array<{ productId: string; unitMargin: number; wasteRatio: number }>
) => {
  return [...products].sort((a, b) => b.unitMargin * (1 - b.wasteRatio) - a.unitMargin * (1 - a.wasteRatio));
};
