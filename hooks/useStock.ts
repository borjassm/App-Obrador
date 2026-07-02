import { useCallback, useEffect, useState } from 'react';

import { stockService, type IngredientStock, type ProductStock } from '@/services/stock.service';

export function useStock() {
  const [ingredients, setIngredients] = useState<IngredientStock[]>([]);
  const [products, setProducts] = useState<ProductStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ing, prod] = await Promise.all([
        stockService.listIngredientStock(),
        stockService.listProductStock(),
      ]);
      setIngredients(ing);
      setProducts(prod);
    } catch (e) {
      console.log('[useStock] error:', e);
      setError('Error al cargar el stock');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const recordIngredientCount = useCallback(
    async (ingredientId: string, quantity: number) => {
      await stockService.recordIngredientCount(ingredientId, quantity);
      await refresh();
    },
    [refresh]
  );

  const recordProductCount = useCallback(
    async (productId: string, quantity: number) => {
      await stockService.recordProductCount(productId, quantity);
      await refresh();
    },
    [refresh]
  );

  const lowCount = ingredients.filter((i) => i.is_low).length;

  return {
    ingredients,
    products,
    loading,
    error,
    refresh,
    recordIngredientCount,
    recordProductCount,
    lowCount,
  };
}
