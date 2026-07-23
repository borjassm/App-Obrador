// Pipeline de producción: dado el nº de días de proceso de un producto
// (product_process_config.process_days), qué fase le toca HOY para cada
// fecha de venta futura. El proceso es secuencial y termina el día de venta:
//
//   3 días → amasado (día 1) · fermentación (día 2) · horneado (día 3 = venta)
//   2 días → amasado (día 1) · horneado (día 2 = venta)
//   1 día  → horneado (mismo día de la venta)
//
// Invertido desde HOY (T): se HORNEA lo que se vende hoy, se FERMENTA lo que
// se vende mañana (procesos de 3 días) y se AMASA lo que se vende mañana
// (2 días) o pasado (3 días).

export type Phase = 'horneado' | 'fermentacion' | 'amasado';

export interface PhaseAssignment {
  sellDate: string; // YYYY-MM-DD, fecha de venta del lote
  phase: Phase; // trabajo que toca HOY para ese lote
  daysUntilSale: 0 | 1 | 2;
}

export const PHASE_ORDER: Phase[] = ['horneado', 'fermentacion', 'amasado'];

// Fecha local YYYY-MM-DD (sin pasar por UTC, igual que la pantalla de Plan)
export function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function getPhaseAssignments(processDays: number, today: Date): PhaseAssignment[] {
  const sell = (n: 0 | 1 | 2) => isoLocal(addDays(today, n));
  switch (processDays) {
    case 1:
      return [{ sellDate: sell(0), phase: 'horneado', daysUntilSale: 0 }];
    case 2:
      return [
        { sellDate: sell(0), phase: 'horneado', daysUntilSale: 0 },
        { sellDate: sell(1), phase: 'amasado', daysUntilSale: 1 },
      ];
    default:
      // 3 días (o cualquier valor no contemplado: se trata como 3)
      return [
        { sellDate: sell(0), phase: 'horneado', daysUntilSale: 0 },
        { sellDate: sell(1), phase: 'fermentacion', daysUntilSale: 1 },
        { sellDate: sell(2), phase: 'amasado', daysUntilSale: 2 },
      ];
  }
}
