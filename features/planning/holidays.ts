// Festivos y periodos vacacionales de España (Madrid) para ajustar la demanda
// prevista del plan de producción. Los festivos variables (Semana Santa) van
// por fecha exacta: AMPLIAR CADA AÑO.

interface FixedHoliday {
  month: number; // 1-12
  day: number;
  name: string;
}

const NATIONAL_HOLIDAYS: FixedHoliday[] = [
  { month: 1, day: 1, name: 'Año Nuevo' },
  { month: 1, day: 6, name: 'Reyes' },
  { month: 5, day: 1, name: 'Día del Trabajador' },
  { month: 5, day: 2, name: 'Comunidad de Madrid' },
  { month: 5, day: 15, name: 'San Isidro' },
  { month: 8, day: 15, name: 'Asunción' },
  { month: 10, day: 12, name: 'Fiesta Nacional' },
  { month: 11, day: 1, name: 'Todos los Santos' },
  { month: 11, day: 9, name: 'La Almudena' },
  { month: 12, day: 6, name: 'Constitución' },
  { month: 12, day: 8, name: 'Inmaculada' },
  { month: 12, day: 25, name: 'Navidad' },
];

// Festivos móviles por fecha exacta (mantener al día año a año)
const VARIABLE_HOLIDAYS: Record<string, string> = {
  '2026-04-02': 'Jueves Santo',
  '2026-04-03': 'Viernes Santo',
  '2027-03-25': 'Jueves Santo',
  '2027-03-26': 'Viernes Santo',
};

interface VacationPeriod {
  from: string; // MM-DD inclusive
  to: string;
  name: string;
  factor: number;
}

const VACATION_PERIODS: VacationPeriod[] = [
  { from: '01-01', to: '01-07', name: 'Navidad–Reyes', factor: 0.7 },
  { from: '08-01', to: '08-31', name: 'Agosto', factor: 0.75 },
  { from: '12-20', to: '12-31', name: 'Navidad', factor: 0.8 },
];

const HOLIDAY_FACTOR = 0.7;

export function isHoliday(dateISO: string): { holiday: boolean; name?: string } {
  const variable = VARIABLE_HOLIDAYS[dateISO];
  if (variable) return { holiday: true, name: variable };
  const month = parseInt(dateISO.slice(5, 7), 10);
  const day = parseInt(dateISO.slice(8, 10), 10);
  const fixed = NATIONAL_HOLIDAYS.find((h) => h.month === month && h.day === day);
  return fixed ? { holiday: true, name: fixed.name } : { holiday: false };
}

export interface HolidayAdjustment {
  factor: number;
  reason?: string;
}

// Festivo tiene prioridad sobre periodo vacacional
export function holidayAdjustmentFactor(dateISO: string): HolidayAdjustment {
  const h = isHoliday(dateISO);
  if (h.holiday) return { factor: HOLIDAY_FACTOR, reason: `Festivo: ${h.name}` };
  const mmdd = dateISO.slice(5);
  const period = VACATION_PERIODS.find((p) => mmdd >= p.from && mmdd <= p.to);
  if (period) return { factor: period.factor, reason: `Periodo: ${period.name}` };
  return { factor: 1 };
}
