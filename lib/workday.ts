// Día de trabajo del registro de sobrantes: el recuento se hace al cerrar la
// tienda, a veces pasada la medianoche. Hasta las 5:00 cuenta como el día
// anterior. No aplicar a la producción: el obrador empieza a las 4:00 y esa
// producción es del día que empieza.
export const LEFTOVERS_DAY_CUTOFF_HOUR = 5;

function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function leftoversDayISO(now: Date = new Date()): string {
  const d = new Date(now);
  if (d.getHours() < LEFTOVERS_DAY_CUTOFF_HOUR) d.setDate(d.getDate() - 1);
  return isoLocal(d);
}
