// Sustitución dentro de familia: si el usuario sube a mano un producto por
// encima de lo sugerido, parte de esa demanda extra canibaliza a los demás
// productos de su misma familia (misma fase y fecha de venta), así que se les
// resta proporcionalmente. Tasa del 30% del exceso; nunca se baja del 50% del
// sugerido de cada producto.

export const FAMILY_SUBSTITUTION_RATE = 0.3;
export const FAMILY_SUBSTITUTION_FLOOR = 0.5;

export interface SubstitutableItem {
  phase: string;
  sellDate: string;
  family: string;
  suggestedQty: number;
  overrideQty: number | null;
  effectiveQty: number;
  naveQty: number;
  tiendaQty: number;
  familyAdjusted: boolean;
}

export function applyFamilySubstitution(items: SubstitutableItem[]): void {
  const groups = new Map<string, SubstitutableItem[]>();
  for (const item of items) {
    const key = `${item.phase}_${item.sellDate}_${item.family}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  for (const group of groups.values()) {
    const absorption = group.reduce(
      (sum, item) =>
        item.overrideQty != null && item.overrideQty > item.suggestedQty
          ? sum + (item.overrideQty - item.suggestedQty) * FAMILY_SUBSTITUTION_RATE
          : sum,
      0
    );
    if (absorption <= 0) continue;

    const others = group.filter((item) => item.overrideQty == null);
    const totalOthers = others.reduce((sum, item) => sum + item.suggestedQty, 0);
    if (totalOthers <= 0) continue;

    for (const item of others) {
      const share = (item.suggestedQty / totalOthers) * absorption;
      const minQty = Math.ceil(item.suggestedQty * FAMILY_SUBSTITUTION_FLOOR);
      const adjusted = Math.max(minQty, Math.round(item.suggestedQty - share));
      if (adjusted < item.suggestedQty) {
        const total = item.naveQty + item.tiendaQty;
        const naveShare = total > 0 ? item.naveQty / total : 0.5;
        item.effectiveQty = adjusted;
        item.familyAdjusted = true;
        item.naveQty = Math.round(adjusted * naveShare);
        item.tiendaQty = adjusted - item.naveQty;
      }
    }
  }
}
