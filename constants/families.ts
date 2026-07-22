// Familias de producto de obrador (products.family) y su orden canónico de
// presentación en toda la app. Valores reales en BD: panaderia, bolleria,
// focaccia, salado, dulce, navidad; 'otros' agrupa productos sin familia.
export const FAMILY_ORDER = [
  'panaderia',
  'bolleria',
  'focaccia',
  'salado',
  'dulce',
  'navidad',
  'otros',
] as const;

// Comparador para ordenar familias según FAMILY_ORDER; las desconocidas van
// al final en orden alfabético.
export function compareFamilies(a: string, b: string): number {
  const ia = FAMILY_ORDER.indexOf(a as (typeof FAMILY_ORDER)[number]);
  const ib = FAMILY_ORDER.indexOf(b as (typeof FAMILY_ORDER)[number]);
  if (ia === -1 && ib === -1) return a.localeCompare(b);
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
}

// Temporada de navidad: noviembre a enero. Fuera de temporada, las pantallas
// colapsan (o despriorizan) la familia 'navidad'.
export function isNavidadSeason(date: Date = new Date()): boolean {
  const month = date.getMonth();
  return month === 10 || month === 11 || month === 0;
}
