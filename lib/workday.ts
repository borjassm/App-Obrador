// Día de trabajo del registro de sobrantes: el recuento se hace al cerrar la
// tienda, a veces pasada la medianoche. Hasta las 5:00 cuenta como el día
// anterior. No aplicar a la producción: el obrador empieza a las 4:00 y esa
// producción es del día que empieza.
export const LEFTOVERS_DAY_CUTOFF_HOUR = 5;

// Días hacia atrás que se pueden corregir en sobrantes (hoy + 7). Lo anterior
// no se modifica, para proteger los datos. La BD aplica el mismo límite en la
// RLS (migración 0017, leftovers_day_editable): si cambia aquí, cambiar allí.
export const LEFTOVERS_EDIT_WINDOW_DAYS = 7;

function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Mediodía para que los cambios de hora no muevan el día
function parseISO(day: string): Date {
  return new Date(`${day}T12:00:00`);
}

export function leftoversDayISO(now: Date = new Date()): string {
  const d = new Date(now);
  if (d.getHours() < LEFTOVERS_DAY_CUTOFF_HOUR) d.setDate(d.getDate() - 1);
  return isoLocal(d);
}

export function addDaysISO(day: string, days: number): string {
  const d = parseISO(day);
  d.setDate(d.getDate() + days);
  return isoLocal(d);
}

/** Días que se pueden registrar o corregir, de hoy hacia atrás */
export function leftoversEditableDays(now: Date = new Date()): string[] {
  const today = leftoversDayISO(now);
  return Array.from({ length: LEFTOVERS_EDIT_WINDOW_DAYS + 1 }, (_, i) => addDaysISO(today, -i));
}

export function isLeftoversDayEditable(day: string, now: Date = new Date()): boolean {
  const today = leftoversDayISO(now);
  return day <= today && day >= addDaysISO(today, -LEFTOVERS_EDIT_WINDOW_DAYS);
}

/** Etiqueta corta del selector: "Hoy", "Ayer", "lun 20" */
export function leftoversDayLabel(day: string, now: Date = new Date()): string {
  const today = leftoversDayISO(now);
  if (day === today) return 'Hoy';
  if (day === addDaysISO(today, -1)) return 'Ayer';
  const d = parseISO(day);
  const weekday = d.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '');
  return `${weekday} ${d.getDate()}`;
}
