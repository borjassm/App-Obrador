import { useCallback, useEffect, useMemo, useState } from 'react';

import { useLocations } from '@/hooks/useLocations';
import { analyticsService } from '@/services/analytics.service';
import {
  salesService,
  type SalesDailyPoint,
  type SalesProductRow,
  type SalesSummary,
} from '@/services/sales.service';

export type QuickPeriod = 'dia' | 'semana' | 'mes' | 'anio' | 'todo';

export interface PeriodRange {
  start: string;
  end: string;
  prevStart?: string;
  prevEnd?: string;
}

function parse(dateStr: string): Date {
  // Mediodía para evitar cambios de día por zona horaria
  return new Date(dateStr + 'T12:00:00');
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, n: number): Date {
  const x = new Date(date);
  x.setDate(x.getDate() + n);
  return x;
}

// Rangos anclados al último día con ventas (anchor), no a la fecha real:
// así la pantalla es útil aunque el import del ERP vaya con retraso.
// Comparativa = tramo equivalente del periodo anterior (misma longitud).
export function getPeriodRange(period: QuickPeriod, anchorISO: string, firstISO: string): PeriodRange {
  const anchor = parse(anchorISO);
  switch (period) {
    case 'dia': {
      const prev = addDays(anchor, -7); // mismo día de la semana anterior
      return { start: anchorISO, end: anchorISO, prevStart: iso(prev), prevEnd: iso(prev) };
    }
    case 'semana': {
      const monday = addDays(anchor, -((anchor.getDay() + 6) % 7));
      return {
        start: iso(monday),
        end: anchorISO,
        prevStart: iso(addDays(monday, -7)),
        prevEnd: iso(addDays(anchor, -7)),
      };
    }
    case 'mes': {
      const y = anchor.getFullYear();
      const m = anchor.getMonth();
      const start = new Date(y, m, 1, 12);
      const prevMonthDays = new Date(y, m, 0).getDate();
      const prevStart = new Date(y, m - 1, 1, 12);
      const prevEnd = new Date(y, m - 1, Math.min(anchor.getDate(), prevMonthDays), 12);
      return { start: iso(start), end: anchorISO, prevStart: iso(prevStart), prevEnd: iso(prevEnd) };
    }
    case 'anio': {
      const y = anchor.getFullYear();
      const prevEnd = new Date(y - 1, anchor.getMonth(), Math.min(anchor.getDate(), 28), 12);
      // día 28 como tope evita el salto del 29 de febrero
      const sameDayPrev =
        anchor.getMonth() === 1 && anchor.getDate() === 29
          ? prevEnd
          : new Date(y - 1, anchor.getMonth(), anchor.getDate(), 12);
      return {
        start: `${y}-01-01`,
        end: anchorISO,
        prevStart: `${y - 1}-01-01`,
        prevEnd: iso(sameDayPrev),
      };
    }
    case 'todo':
      return { start: firstISO, end: anchorISO };
  }
}

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function formatPeriodLabel(period: QuickPeriod, range: PeriodRange): string {
  const start = parse(range.start);
  const end = parse(range.end);
  if (period === 'dia') {
    const label = end.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }
  const sameYear = start.getFullYear() === end.getFullYear();
  const startLabel = `${start.getDate()} ${MONTHS_SHORT[start.getMonth()]}${sameYear ? '' : ` ${start.getFullYear()}`}`;
  const endLabel = `${end.getDate()} ${MONTHS_SHORT[end.getMonth()]} ${end.getFullYear()}`;
  const rangeLabel = `${startLabel} – ${endLabel}`;
  return period === 'todo' ? `Todo el historial · ${rangeLabel}` : rangeLabel;
}

export interface SalesData {
  anchor: string;
  summary: SalesSummary | null;
  prevSummary: SalesSummary | null;
  series: SalesDailyPoint[];
  products: SalesProductRow[];
}

export function useSales() {
  const [period, setPeriod] = useState<QuickPeriod>('dia');
  const [locationId, setLocationId] = useState<string | 'all'>('all');
  const locations = useLocations();
  const [anchor, setAnchor] = useState<string | null>(null);
  const [first, setFirst] = useState<string | null>(null);
  const [data, setData] = useState<SalesData | null>(null);
  const [loading, setLoading] = useState(true);

  // Carga inicial: anclas de fechas
  useEffect(() => {
    (async () => {
      const [dates, firstDate] = await Promise.all([
        analyticsService.latestDates(),
        salesService.firstSaleDate(),
      ]);
      setAnchor(dates?.latest_sale ?? null);
      setFirst(firstDate);
      if (!dates?.latest_sale) setLoading(false);
    })();
  }, []);

  const range = useMemo(
    () => (anchor ? getPeriodRange(period, anchor, first ?? anchor) : null),
    [period, anchor, first]
  );

  const fetchData = useCallback(async () => {
    if (!anchor || !range) return;
    setLoading(true);
    const loc = locationId === 'all' ? null : locationId;
    const [summary, prevSummary, series, products] = await Promise.all([
      salesService.periodSummary(range.start, range.end, loc),
      range.prevStart && range.prevEnd
        ? salesService.periodSummary(range.prevStart, range.prevEnd, loc)
        : Promise.resolve(null),
      salesService.periodSeries(range.start, range.end, loc),
      salesService.periodProducts(range.start, range.end, loc),
    ]);
    setData({ anchor, summary, prevSummary, series, products });
    setLoading(false);
  }, [anchor, range, locationId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const periodLabel = useMemo(
    () => (range ? formatPeriodLabel(period, range) : ''),
    [period, range]
  );

  return {
    period,
    setPeriod,
    locationId,
    setLocationId,
    locations,
    data,
    loading,
    periodLabel,
    refresh: fetchData,
  };
}
